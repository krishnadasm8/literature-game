import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface CreateGameInput {
  roomId: string;
  roomPlayerUserIds: string[];
}

export const gameManager = {
  async createGame(input: CreateGameInput) {
    const currentTurnPlayerId = input.roomPlayerUserIds[0] ?? null;
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
        round: 1,
      },
    });
  },
};
