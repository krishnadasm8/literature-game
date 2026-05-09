"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_middleware_1 = require("../middleware/auth.middleware");
const deck_1 = require("../engine/deck");
const sockets_1 = require("../sockets");
const gameManager_1 = require("../services/gameManager");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const pendingAsks = new Map();
const TEAM_BY_SEAT = ["TEAM_A", "TEAM_B", "TEAM_A", "TEAM_B", "TEAM_A", "TEAM_B", "TEAM_A", "TEAM_B"];
const getPlayerTeam = (player, index) => {
    if (player.team === "TEAM_A" || player.team === "TEAM_B") {
        return player.team;
    }
    return TEAM_BY_SEAT[index] ?? "TEAM_A";
};
const removeHalfSuitCards = (handsSnapshot, halfSuit) => {
    const next = {};
    for (const [playerId, cards] of Object.entries(handsSnapshot)) {
        next[playerId] = cards.filter((card) => card.halfSuit !== halfSuit);
    }
    return next;
};
router.get("/:id", auth_middleware_1.authMiddleware, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    const game = await gameManager_1.gameManager.getGameState({
        gameIdOrRoomCode: String(req.params.id),
        requestingPlayerId: userId,
    });
    if (!game) {
        res.status(404).json({ error: "Game not found." });
        return;
    }
    res.status(200).json(game);
});
router.post("/:id/move", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const gameId = String(req.params.id);
        const targetPlayerId = req.body?.targetPlayerId;
        const card = req.body?.card;
        if (!targetPlayerId || !card) {
            res.status(400).json({ error: "targetPlayerId and card are required." });
            return;
        }
        const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: {
                room: {
                    include: {
                        players: {
                            include: {
                                user: true,
                            },
                        },
                    },
                },
            },
        });
        if (!game) {
            res.status(404).json({ error: "Game not found." });
            return;
        }
        if (game.currentTurnPlayerId !== userId) {
            res.status(400).json({ error: "It is not your turn." });
            return;
        }
        const players = [...game.room.players].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
        const askingPlayer = players.find((player) => player.userId === userId);
        const targetPlayer = players.find((player) => player.userId === targetPlayerId);
        if (!askingPlayer || !targetPlayer) {
            res.status(400).json({ error: "Invalid player selection." });
            return;
        }
        if (askingPlayer.team === targetPlayer.team) {
            res.status(400).json({ error: "You can only ask an opponent." });
            return;
        }
        const handsSnapshot = (game.handsSnapshot ?? {});
        const askingHand = [...(handsSnapshot[userId] ?? [])];
        const targetHand = [...(handsSnapshot[targetPlayerId] ?? [])];
        const hasHalfSuitCard = askingHand.some((owned) => owned.halfSuit === card.halfSuit);
        if (!hasHalfSuitCard) {
            res.status(400).json({ error: "You must hold at least one card from that half-suit." });
            return;
        }
        const alreadyOwns = askingHand.some((owned) => owned.rank === card.rank && owned.suit === card.suit);
        if (alreadyOwns) {
            res.status(400).json({ error: "You already have that card." });
            return;
        }
        const targetCardIndex = targetHand.findIndex((owned) => owned.rank === card.rank && owned.suit === card.suit);
        const targetHasCard = targetCardIndex >= 0;
        await prisma.move.create({
            data: {
                gameId: game.id,
                playerId: userId,
                targetPlayerId,
                type: "ASK",
                cardSuit: card.suit,
                cardRank: card.rank,
                cardHalfSuit: card.halfSuit,
            },
        });
        const pendingAsk = {
            gameId: game.id,
            roomCode: game.room.roomCode,
            askingPlayerId: userId,
            askingPlayerName: askingPlayer.user.displayName,
            targetPlayerId,
            targetPlayerName: targetPlayer.user.displayName,
            card,
        };
        pendingAsks.set(game.id, pendingAsk);
        (0, sockets_1.emitToGameNamespace)(game.room.roomCode, "game:ask_requested", {
            gameId: game.id,
            askingPlayerId: userId,
            askingPlayerName: askingPlayer.user.displayName,
            targetPlayerId,
            targetPlayerName: targetPlayer.user.displayName,
            card,
            targetHasCard,
        });
        res.status(200).json({
            pending: true,
            targetHasCard,
            message: `Ask sent to ${targetPlayer.user.displayName}`,
        });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to play move." });
    }
});
router.post("/:id/respond", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const gameId = String(req.params.id);
        const responseType = String(req.body?.response ?? "").toUpperCase();
        if (responseType !== "GIVE" && responseType !== "NO") {
            res.status(400).json({ error: "response must be GIVE or NO." });
            return;
        }
        const pending = pendingAsks.get(gameId);
        if (!pending) {
            res.status(400).json({ error: "No pending ask for this game." });
            return;
        }
        if (pending.targetPlayerId !== userId) {
            res.status(403).json({ error: "Only asked player can respond." });
            return;
        }
        const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: {
                room: true,
            },
        });
        if (!game) {
            res.status(404).json({ error: "Game not found." });
            return;
        }
        const handsSnapshot = (game.handsSnapshot ?? {});
        const askingHand = [...(handsSnapshot[pending.askingPlayerId] ?? [])];
        const targetHand = [...(handsSnapshot[pending.targetPlayerId] ?? [])];
        const targetCardIndex = targetHand.findIndex((owned) => owned.rank === pending.card.rank && owned.suit === pending.card.suit);
        const targetHasCard = targetCardIndex >= 0;
        let acceptedGive = responseType === "GIVE";
        if (acceptedGive && !targetHasCard) {
            acceptedGive = false;
        }
        if (acceptedGive && targetCardIndex >= 0) {
            const [transferredCard] = targetHand.splice(targetCardIndex, 1);
            askingHand.push(transferredCard);
        }
        handsSnapshot[pending.askingPlayerId] = askingHand;
        handsSnapshot[pending.targetPlayerId] = targetHand;
        const nextTurnPlayerId = acceptedGive ? pending.askingPlayerId : pending.targetPlayerId;
        await prisma.game.update({
            where: { id: game.id },
            data: {
                currentTurnPlayerId: nextTurnPlayerId,
                handsSnapshot: handsSnapshot,
            },
        });
        (0, sockets_1.emitToGameNamespace)(pending.roomCode, "game:ask_resolved", {
            gameId,
            askingPlayerId: pending.askingPlayerId,
            targetPlayerId: pending.targetPlayerId,
            card: pending.card,
            result: acceptedGive ? "GIVE" : "NO",
            message: acceptedGive
                ? `${pending.targetPlayerName} gave ${pending.card.rank} of ${pending.card.suit}`
                : `${pending.targetPlayerName} said no`,
        });
        const askingState = await gameManager_1.gameManager.getGameState({
            gameIdOrRoomCode: gameId,
            requestingPlayerId: pending.askingPlayerId,
        });
        const targetState = await gameManager_1.gameManager.getGameState({
            gameIdOrRoomCode: gameId,
            requestingPlayerId: pending.targetPlayerId,
        });
        (0, sockets_1.emitToGameNamespace)(pending.roomCode, "game:state_update", {
            gameState: askingState?.gameState ?? targetState?.gameState,
        });
        pendingAsks.delete(gameId);
        const requesterState = await gameManager_1.gameManager.getGameState({
            gameIdOrRoomCode: gameId,
            requestingPlayerId: userId,
        });
        res.status(200).json(requesterState);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to respond to ask." });
    }
});
router.post("/:id/declare", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const gameId = String(req.params.id);
        const halfSuit = req.body?.halfSuit;
        if (!halfSuit) {
            res.status(400).json({ error: "halfSuit is required." });
            return;
        }
        const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: {
                room: {
                    include: {
                        players: {
                            include: {
                                user: true,
                            },
                        },
                    },
                },
            },
        });
        if (!game) {
            res.status(404).json({ error: "Game not found." });
            return;
        }
        if (game.currentTurnPlayerId !== userId) {
            res.status(400).json({ error: "It is not your turn." });
            return;
        }
        const orderedPlayers = [...game.room.players].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
        const declaringIndex = orderedPlayers.findIndex((player) => player.userId === userId);
        if (declaringIndex < 0) {
            res.status(400).json({ error: "Declaring player not found." });
            return;
        }
        const declaringPlayer = orderedPlayers[declaringIndex];
        const declaringTeam = getPlayerTeam(declaringPlayer, declaringIndex);
        const handsSnapshot = (game.handsSnapshot ?? {});
        const halfSuitCardsByPlayer = orderedPlayers
            .map((player, index) => ({
            playerId: player.userId,
            playerName: player.user.displayName,
            team: getPlayerTeam(player, index),
            cards: (handsSnapshot[player.userId] ?? []).filter((card) => card.halfSuit === halfSuit),
        }))
            .filter((entry) => entry.cards.length > 0);
        const totalHalfSuitCards = halfSuitCardsByPlayer.reduce((sum, entry) => sum + entry.cards.length, 0);
        const teamOwnedCards = halfSuitCardsByPlayer
            .filter((entry) => entry.team === declaringTeam)
            .reduce((sum, entry) => sum + entry.cards.length, 0);
        const success = totalHalfSuitCards === 6 && teamOwnedCards === 6;
        const scoreDelta = success ? 1 : -1;
        const currentScores = game.scores ?? {
            TEAM_A: 0,
            TEAM_B: 0,
        };
        const nextScores = {
            TEAM_A: currentScores.TEAM_A ?? 0,
            TEAM_B: currentScores.TEAM_B ?? 0,
        };
        nextScores[declaringTeam] = (nextScores[declaringTeam] ?? 0) + scoreDelta;
        const currentBooks = game.books ?? { TEAM_A: [], TEAM_B: [] };
        const nextBooks = {
            TEAM_A: [...(currentBooks.TEAM_A ?? [])],
            TEAM_B: [...(currentBooks.TEAM_B ?? [])],
        };
        if (success) {
            nextBooks[declaringTeam].push(halfSuit);
        }
        const nextHands = removeHalfSuitCards(handsSnapshot, halfSuit);
        await prisma.move.create({
            data: {
                gameId: game.id,
                playerId: userId,
                type: "DECLARE",
                declaredSet: halfSuit,
            },
        });
        await prisma.game.update({
            where: { id: game.id },
            data: {
                scores: nextScores,
                books: nextBooks,
                handsSnapshot: nextHands,
                currentTurnPlayerId: userId,
            },
        });
        const declaredCardsByPlayer = halfSuitCardsByPlayer.map((entry) => ({
            playerId: entry.playerId,
            playerName: entry.playerName,
            cards: entry.cards.map((card) => ({
                ...card,
                code: (0, deck_1.cardToCode)(card),
            })),
        }));
        (0, sockets_1.emitToGameNamespace)(game.room.roomCode, "game:declaration_started", {
            gameId: game.id,
            declaringPlayerId: userId,
            declaringPlayerName: declaringPlayer.user.displayName,
            halfSuit,
            declaredCardsByPlayer,
        });
        (0, sockets_1.emitToGameNamespace)(game.room.roomCode, "game:declaration_result", {
            gameId: game.id,
            declaringPlayerId: userId,
            declaringPlayerName: declaringPlayer.user.displayName,
            halfSuit,
            success,
            scoreDelta,
            declaringTeam,
            newScore: nextScores[declaringTeam],
            message: success ? "Declaration successful! +1 point" : "Declaration failed! -1 point",
        });
        const updatedState = await gameManager_1.gameManager.getGameState({
            gameIdOrRoomCode: game.id,
            requestingPlayerId: userId,
        });
        (0, sockets_1.emitToGameNamespace)(game.room.roomCode, "game:state_update", {
            gameState: updatedState?.gameState,
        });
        res.status(200).json({
            ok: true,
            success,
            scoreDelta,
            declaringTeam,
            newScore: nextScores[declaringTeam],
            declaredCardsByPlayer,
            gameState: updatedState?.gameState,
            myHand: updatedState?.myHand ?? [],
        });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to declare set." });
    }
});
router.post("/:id/timeout", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const gameId = String(req.params.id);
        const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: {
                room: {
                    include: {
                        players: {
                            include: {
                                user: true,
                            },
                        },
                    },
                },
            },
        });
        if (!game) {
            res.status(404).json({ error: "Game not found." });
            return;
        }
        if (game.currentTurnPlayerId !== userId) {
            res.status(400).json({ error: "Only current turn player can timeout pass." });
            return;
        }
        const players = [...game.room.players].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
        const currentPlayer = players.find((player) => player.userId === userId);
        if (!currentPlayer) {
            res.status(400).json({ error: "Current player not found in room." });
            return;
        }
        const nextPlayer = players.find((player) => player.team !== currentPlayer.team) ??
            players.find((player) => player.userId !== currentPlayer.userId);
        if (!nextPlayer) {
            res.status(400).json({ error: "No eligible player to pass turn." });
            return;
        }
        await prisma.game.update({
            where: { id: game.id },
            data: {
                currentTurnPlayerId: nextPlayer.userId,
            },
        });
        (0, sockets_1.emitToGameNamespace)(game.room.roomCode, "game:turn_changed", {
            gameId: game.id,
            currentTurnPlayerId: nextPlayer.userId,
            currentTurnPlayerName: nextPlayer.user.displayName,
            reason: "TIMEOUT",
        });
        const updatedForCurrent = await gameManager_1.gameManager.getGameState({
            gameIdOrRoomCode: game.id,
            requestingPlayerId: userId,
        });
        (0, sockets_1.emitToGameNamespace)(game.room.roomCode, "game:state_update", {
            gameState: updatedForCurrent?.gameState,
        });
        res.status(200).json({
            ok: true,
            message: `Turn passed to ${nextPlayer.user.displayName}`,
            currentTurnPlayerId: nextPlayer.userId,
            currentTurnPlayerName: nextPlayer.user.displayName,
        });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to pass timed-out turn." });
    }
});
router.post("/:id/forfeit", (_req, res) => {
    res.status(501).json({ message: "Not implemented" });
});
exports.default = router;
