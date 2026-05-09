import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import type { AuthenticatedRequest } from "../middleware/auth.middleware";
import { authMiddleware } from "../middleware/auth.middleware";
import type { Card } from "../engine/deck";
import { emitToGameNamespace } from "../sockets";
import { gameManager } from "../services/gameManager";

const router = Router();
const prisma = new PrismaClient();
type PendingAsk = {
  gameId: string;
  roomCode: string;
  askingPlayerId: string;
  askingPlayerName: string;
  targetPlayerId: string;
  targetPlayerName: string;
  card: Card;
};
const pendingAsks = new Map<string, PendingAsk>();

router.get("/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const game = await gameManager.getGameState({
    gameIdOrRoomCode: String(req.params.id),
    requestingPlayerId: userId,
  });

  if (!game) {
    res.status(404).json({ error: "Game not found." });
    return;
  }

  res.status(200).json(game);
});

router.post("/:id/move", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const gameId = String(req.params.id);
    const targetPlayerId = req.body?.targetPlayerId as string | undefined;
    const card = req.body?.card as Card | undefined;

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

    const handsSnapshot = (((game as any).handsSnapshot ?? {}) as Record<string, Card[]>);
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
        cardSuit: card.suit as any,
        cardRank: card.rank as any,
        cardHalfSuit: card.halfSuit as any,
      },
    });

    const pendingAsk: PendingAsk = {
      gameId: game.id,
      roomCode: game.room.roomCode,
      askingPlayerId: userId,
      askingPlayerName: askingPlayer.user.displayName,
      targetPlayerId,
      targetPlayerName: targetPlayer.user.displayName,
      card,
    };
    pendingAsks.set(game.id, pendingAsk);

    emitToGameNamespace(game.room.roomCode, "game:ask_requested", {
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
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to play move." });
  }
});

router.post("/:id/respond", authMiddleware, async (req: AuthenticatedRequest, res) => {
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

    const handsSnapshot = (((game as any).handsSnapshot ?? {}) as Record<string, Card[]>);
    const askingHand = [...(handsSnapshot[pending.askingPlayerId] ?? [])];
    const targetHand = [...(handsSnapshot[pending.targetPlayerId] ?? [])];
    const targetCardIndex = targetHand.findIndex(
      (owned) => owned.rank === pending.card.rank && owned.suit === pending.card.suit,
    );
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
        handsSnapshot: handsSnapshot as any,
      } as any,
    });

    emitToGameNamespace(pending.roomCode, "game:ask_resolved", {
      gameId,
      askingPlayerId: pending.askingPlayerId,
      targetPlayerId: pending.targetPlayerId,
      card: pending.card,
      result: acceptedGive ? "GIVE" : "NO",
      message: acceptedGive
        ? `${pending.targetPlayerName} gave ${pending.card.rank} of ${pending.card.suit}`
        : `${pending.targetPlayerName} said no`,
    });

    const askingState = await gameManager.getGameState({
      gameIdOrRoomCode: gameId,
      requestingPlayerId: pending.askingPlayerId,
    });
    const targetState = await gameManager.getGameState({
      gameIdOrRoomCode: gameId,
      requestingPlayerId: pending.targetPlayerId,
    });

    emitToGameNamespace(pending.roomCode, "game:state_update", {
      gameState: askingState?.gameState ?? targetState?.gameState,
    });

    pendingAsks.delete(gameId);

    const requesterState = await gameManager.getGameState({
      gameIdOrRoomCode: gameId,
      requestingPlayerId: userId,
    });
    res.status(200).json(requesterState);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to respond to ask." });
  }
});

router.post("/:id/forfeit", (_req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

export default router;
