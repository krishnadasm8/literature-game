import { PrismaClient } from "@prisma/client";
import { createDeck, dealCards, shuffleDeck, type Card } from "../engine/deck";

const prisma = new PrismaClient();

interface CreateGameInput {
  roomId: string;
  roomPlayerUserIds: string[];
}

interface GetGameStateInput {
  gameIdOrRoomCode: string;
  requestingPlayerId: string;
}

export const gameManager = {
  async createGame(input: CreateGameInput) {
    const currentTurnPlayerId = input.roomPlayerUserIds[0] ?? null;
    const deck = createDeck();
    const shuffledDeck = shuffleDeck(deck);
    const dealt = dealCards(shuffledDeck, input.roomPlayerUserIds.length);
    const handsSnapshot: Record<string, Card[]> = {};

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
    } as any);
  },
  async getGameState(input: GetGameStateInput) {
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

    const orderedPlayers = [...game.room.players].sort(
      (a, b) => a.joinedAt.getTime() - b.joinedAt.getTime(),
    );

    const teamBySeat = ["TEAM_A", "TEAM_B", "TEAM_A", "TEAM_B", "TEAM_A", "TEAM_B", "TEAM_A", "TEAM_B"] as const;
    const scores = (game.scores as Record<string, number> | null) ?? { TEAM_A: 0, TEAM_B: 0 };
    const books = (game.books as Record<string, unknown[]> | null) ?? { TEAM_A: [], TEAM_B: [] };
    const handsSnapshot = (((game as any).handsSnapshot ?? {}) as Record<string, Card[]>);

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
