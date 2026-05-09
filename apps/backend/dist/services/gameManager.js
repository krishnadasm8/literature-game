"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameManager = void 0;
const client_1 = require("@prisma/client");
const deck_1 = require("../engine/deck");
const prisma = new client_1.PrismaClient();
exports.gameManager = {
    async createGame(input) {
        const currentTurnPlayerId = input.roomPlayerUserIds[0] ?? null;
        const deck = (0, deck_1.createDeck)();
        const shuffledDeck = (0, deck_1.shuffleDeck)(deck);
        const dealt = (0, deck_1.dealCards)(shuffledDeck, input.roomPlayerUserIds.length);
        const handsSnapshot = {};
        input.roomPlayerUserIds.forEach((playerId, index) => {
            handsSnapshot[playerId] = dealt.hands[String(index)] ?? [];
        });
        return prisma.game.create({
            data: {
                roomId: input.roomId,
                status: "PLAYING",
                currentTurnPlayerId,
                scores: {
                    TEAM_A: 0,
                    TEAM_B: 0,
                },
                books: {
                    TEAM_A: [],
                    TEAM_B: [],
                },
                handsSnapshot,
                round: 1,
            },
        });
    },
    async getGameState(input) {
        const codeOrId = input.gameIdOrRoomCode;
        const game = await prisma.game.findFirst({
            where: {
                OR: [
                    { id: codeOrId },
                    { room: { roomCode: codeOrId.toUpperCase() } },
                ],
            },
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
            return null;
        }
        const orderedPlayers = [...game.room.players].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
        const teamBySeat = ["TEAM_A", "TEAM_B", "TEAM_A", "TEAM_B", "TEAM_A", "TEAM_B", "TEAM_A", "TEAM_B"];
        const scores = game.scores ?? { TEAM_A: 0, TEAM_B: 0 };
        const books = game.books ?? { TEAM_A: [], TEAM_B: [] };
        const handsSnapshot = (game.handsSnapshot ?? {});
        return {
            gameState: {
                id: game.id,
                roomId: game.roomId,
                status: game.status,
                currentTurnPlayerId: game.currentTurnPlayerId ?? orderedPlayers[0]?.userId ?? "",
                players: orderedPlayers.map((roomPlayer, index) => ({
                    id: roomPlayer.user.id,
                    displayName: roomPlayer.user.displayName,
                    avatarUrl: roomPlayer.user.avatarUrl ?? "",
                    team: roomPlayer.team ?? teamBySeat[index],
                    handCount: (handsSnapshot[roomPlayer.user.id] ?? []).length,
                    isBot: roomPlayer.user.googleId.startsWith("bot_"),
                    isConnected: true,
                })),
                scores: {
                    TEAM_A: scores.TEAM_A ?? 0,
                    TEAM_B: scores.TEAM_B ?? 0,
                },
                books: {
                    TEAM_A: books.TEAM_A ?? [],
                    TEAM_B: books.TEAM_B ?? [],
                },
                lastMove: undefined,
                round: game.round,
            },
            myHand: handsSnapshot[input.requestingPlayerId] ?? [],
        };
    },
};
