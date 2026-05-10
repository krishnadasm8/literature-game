import { PrismaClient } from "@prisma/client";
import { cardToCode, createDeck, dealCards, getHalfSuitCards, shuffleDeck, type Card, type HalfSuit } from "../engine/deck";
import { applyAsk, applyDeclare, isValidAsk, isValidDeclare, type GameState as RulesGameState } from "../engine/rules";
import { emitToGameNamespace, emitToRoomNamespace } from "../sockets";

const prisma = new PrismaClient();

interface CreateGameInput {
  roomId: string;
  roomPlayerUserIds: string[];
}

interface GetGameStateInput {
  gameIdOrRoomCode: string;
  requestingPlayerId: string;
}

type TeamId = "TEAM_A" | "TEAM_B";
const TEAM_BY_SEAT: TeamId[] = ["TEAM_A", "TEAM_B", "TEAM_A", "TEAM_B", "TEAM_A", "TEAM_B", "TEAM_A", "TEAM_B"];

interface TurnPlayerSnapshot {
  id: string;
  team: TeamId;
}

interface SnapshotState {
  roomId: string;
  players: TurnPlayerSnapshot[];
  handsSnapshot: Record<string, Card[]>;
  books: Record<TeamId, unknown[]>;
}

interface PlayerStatSummary {
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
}

const getOpponentTeam = (team: TeamId): TeamId => (team === "TEAM_A" ? "TEAM_B" : "TEAM_A");

const getTeamBySeat = (team: string | null, index: number): TeamId => {
  if (team === "TEAM_A" || team === "TEAM_B") {
    return team;
  }
  return TEAM_BY_SEAT[index] ?? "TEAM_A";
};

async function getNextMoveSequence(gameId: string): Promise<number> {
  const count = await prisma.move.count({
    where: { gameId },
  });
  return count + 1;
}

function buildGameStateFromDb(game: any): RulesGameState {
  const orderedPlayers = [...(game.room.players ?? [])].sort(
    (a, b) => a.joinedAt.getTime() - b.joinedAt.getTime(),
  );
  const handsSnapshot = (((game as any).handsSnapshot ?? {}) as Record<string, Card[]>);
  const scores = (game.scores as Record<TeamId, number> | null) ?? { TEAM_A: 0, TEAM_B: 0 };
  const books = (game.books as Record<TeamId, HalfSuit[]> | null) ?? { TEAM_A: [], TEAM_B: [] };

  return {
    id: game.id,
    roomId: game.roomId,
    status: game.status,
    currentTurnPlayerId: game.currentTurnPlayerId ?? orderedPlayers[0]?.userId ?? "",
    players: orderedPlayers.map((player, index) => ({
      id: player.userId,
      team: getTeamBySeat(player.team, index),
      handCount: (handsSnapshot[player.userId] ?? []).length,
      isConnected: true,
    })),
    hands: handsSnapshot,
    scores: {
      TEAM_A: scores.TEAM_A ?? 0,
      TEAM_B: scores.TEAM_B ?? 0,
    },
    books: {
      TEAM_A: books.TEAM_A ?? [],
      TEAM_B: books.TEAM_B ?? [],
    },
    round: game.round,
  };
}

const buildActualCardHolders = (
  gameState: RulesGameState,
  halfSuit: HalfSuit,
): Record<string, string> => {
  const holders: Record<string, string> = {};
  const halfSuitCards = getHalfSuitCards(halfSuit);

  for (const card of halfSuitCards) {
    const code = cardToCode(card);
    holders[code] = "";
    for (const player of gameState.players) {
      const found = (gameState.hands[player.id] ?? []).some(
        (owned) => owned.rank === card.rank && owned.suit === card.suit,
      );
      if (found) {
        holders[code] = player.id;
        break;
      }
    }
  }

  return holders;
};

const buildTeamDeclarationCardHolders = (
  gameState: RulesGameState,
  halfSuit: HalfSuit,
  declaringPlayerId: string,
): Record<string, string> => {
  const actualHolders = buildActualCardHolders(gameState, halfSuit);
  const declaringTeam =
    gameState.players.find((player) => player.id === declaringPlayerId)?.team ?? "TEAM_A";

  return Object.fromEntries(
    Object.entries(actualHolders).map(([cardCode, holderId]) => {
      const holderTeam = gameState.players.find((player) => player.id === holderId)?.team;
      if (holderId && holderTeam === declaringTeam) {
        return [cardCode, holderId];
      }
      // Force declaration claim onto declaring team; rules/applyDeclare will mark it incorrect.
      return [cardCode, declaringPlayerId];
    }),
  );
};

const findGameByIdOrRoomCode = async (gameIdOrRoomCode: string) => {
  return prisma.game.findFirst({
    where: {
      OR: [{ id: gameIdOrRoomCode }, { room: { roomCode: gameIdOrRoomCode.toUpperCase() } }],
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
};

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
    const game = await findGameByIdOrRoomCode(input.gameIdOrRoomCode);

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
  async processAsk(gameIdOrRoomCode: string, askingPlayerId: string, targetPlayerId: string, card: Card): Promise<{
    success: boolean;
    newState: RulesGameState;
    myHand: Card[];
    targetPlayerName: string;
    cardName: string;
    nextTurnPlayerId: string;
    isGameOver: boolean;
    winner?: string;
    roomCode: string;
    targetHadCard: boolean;
    askingPlayerName: string;
  }> {
    const game = await findGameByIdOrRoomCode(gameIdOrRoomCode);
    if (!game) {
      throw new Error("Game not found.");
    }

    const currentState = buildGameStateFromDb(game);
    const validation = isValidAsk(currentState, askingPlayerId, targetPlayerId, card);
    if (!validation.valid) {
      throw new Error(validation.reason ?? "Invalid ask.");
    }

    const targetHadCard = (currentState.hands[targetPlayerId] ?? []).some(
      (owned) => owned.rank === card.rank && owned.suit === card.suit,
    );
    const newState = applyAsk(currentState, askingPlayerId, targetPlayerId, card);
    const targetPlayerName =
      game.room.players.find((player) => player.userId === targetPlayerId)?.user.displayName ?? "Player";
    const askingPlayerName =
      game.room.players.find((player) => player.userId === askingPlayerId)?.user.displayName ?? "Player";

    await prisma.game.update({
      where: { id: game.id },
      data: {
        currentTurnPlayerId: newState.currentTurnPlayerId,
        handsSnapshot: newState.hands as any,
        scores: newState.scores as any,
        books: newState.books as any,
        status: newState.status,
      } as any,
    });

    await prisma.move.create({
      data: {
        gameId: game.id,
        playerId: askingPlayerId,
        targetPlayerId,
        type: "ASK",
        cardSuit: card.suit as any,
        cardRank: card.rank as any,
        cardHalfSuit: card.halfSuit as any,
      },
    });
    await getNextMoveSequence(game.id);

    const snapshotState: SnapshotState = {
      roomId: newState.roomId,
      players: newState.players.map((player) => ({ id: player.id, team: player.team })),
      handsSnapshot: newState.hands,
      books: {
        TEAM_A: newState.books.TEAM_A,
        TEAM_B: newState.books.TEAM_B,
      },
    };
    const isGameOver = this.checkGameOver(snapshotState);
    let winner: string | undefined;
    if (isGameOver) {
      await prisma.game.update({
        where: { id: game.id },
        data: { status: "FINISHED" },
      });
      await prisma.room.update({
        where: { id: game.roomId },
        data: { status: "FINISHED" },
      });
      winner = this.resolveGameWinner(newState.scores);
    }

    return {
      success: true,
      newState,
      myHand: newState.hands[askingPlayerId] ?? [],
      targetPlayerName,
      cardName: `${card.rank} of ${card.suit}`,
      nextTurnPlayerId: newState.currentTurnPlayerId,
      isGameOver,
      winner,
      roomCode: game.room.roomCode,
      targetHadCard,
      askingPlayerName,
    };
  },
  async processDeclare(gameIdOrRoomCode: string, declaringPlayerId: string, halfSuit: string): Promise<{
    success: boolean;
    correct: boolean;
    winningTeam: string;
    newScore: Record<string, number>;
    newState: RulesGameState;
    myHand: Card[];
    isGameOver: boolean;
    winner?: string;
    ranOutOfCards: boolean;
    nextTurnPlayerId: string;
    roomCode: string;
  }> {
    const game = await findGameByIdOrRoomCode(gameIdOrRoomCode);
    if (!game) {
      throw new Error("Game not found.");
    }

    const currentState = buildGameStateFromDb(game);
    const parsedHalfSuit = halfSuit as HalfSuit;
    const declaration = {
      halfSuit: parsedHalfSuit,
      cardHolders: buildTeamDeclarationCardHolders(currentState, parsedHalfSuit, declaringPlayerId),
    };

    const validation = isValidDeclare(currentState, declaringPlayerId, declaration);
    if (!validation.valid) {
      throw new Error(validation.reason ?? "Invalid declare.");
    }

    const declaringTeam = currentState.players.find((player) => player.id === declaringPlayerId)?.team ?? "TEAM_A";
    const newState = applyDeclare(currentState, declaringPlayerId, declaration);
    const correct = newState.books[declaringTeam].length > currentState.books[declaringTeam].length;
    const winningTeam = correct ? declaringTeam : getOpponentTeam(declaringTeam);

    await prisma.game.update({
      where: { id: game.id },
      data: {
        currentTurnPlayerId: newState.currentTurnPlayerId,
        handsSnapshot: newState.hands as any,
        scores: newState.scores as any,
        books: newState.books as any,
        status: newState.status,
      } as any,
    });

    await prisma.move.create({
      data: {
        gameId: game.id,
        playerId: declaringPlayerId,
        type: "DECLARE",
        declaredSet: parsedHalfSuit as any,
      },
    });
    await getNextMoveSequence(game.id);

    const ranOutOfCards = (newState.hands[declaringPlayerId] ?? []).length === 0;
    const snapshotState: SnapshotState = {
      roomId: newState.roomId,
      players: newState.players.map((player) => ({ id: player.id, team: player.team })),
      handsSnapshot: newState.hands,
      books: {
        TEAM_A: newState.books.TEAM_A,
        TEAM_B: newState.books.TEAM_B,
      },
    };
    const isGameOver = this.checkGameOver(snapshotState, declaringTeam);
    let winner: string | undefined;
    if (isGameOver) {
      await prisma.game.update({
        where: { id: game.id },
        data: { status: "FINISHED" },
      });
      await prisma.room.update({
        where: { id: game.roomId },
        data: { status: "FINISHED" },
      });
      winner = this.resolveGameWinner(newState.scores);
    }

    return {
      success: true,
      correct,
      winningTeam,
      newScore: newState.scores,
      newState,
      myHand: newState.hands[declaringPlayerId] ?? [],
      isGameOver,
      winner,
      ranOutOfCards,
      nextTurnPlayerId: newState.currentTurnPlayerId,
      roomCode: game.room.roomCode,
    };
  },
  async emitGameOver(roomCode: string, gameState: any, winner: string): Promise<void> {
    const room = await prisma.room.findUnique({
      where: { roomCode: roomCode.toUpperCase() },
      include: {
        players: true,
      },
    });
    if (room) {
      await prisma.room.update({
        where: { id: room.id },
        data: { status: "FINISHED" },
      });

      const orderedPlayers = [...room.players].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
      const participants = orderedPlayers.map((player) => ({
        userId: player.userId,
        team: getTeamBySeat(player.team, orderedPlayers.indexOf(player)),
      }));
      const participantIds = participants.map((player) => player.userId);
      if (participantIds.length > 0) {
        await prisma.user.updateMany({
          where: { id: { in: participantIds } },
          data: {
            gamesPlayed: { increment: 1 },
          },
        });

        if (winner === "TEAM_A" || winner === "TEAM_B") {
          const winnerIds = participants
            .filter((player) => player.team === winner)
            .map((player) => player.userId);
          if (winnerIds.length > 0) {
            await prisma.user.updateMany({
              where: { id: { in: winnerIds } },
              data: {
                gamesWon: { increment: 1 },
              },
            });
          }
        }
      }
    }
    const updatedUsers = room
      ? await prisma.user.findMany({
          where: {
            id: { in: room.players.map((player) => player.userId) },
          },
          select: {
            id: true,
            gamesPlayed: true,
            gamesWon: true,
          },
        })
      : [];
    const playerStats: Record<string, PlayerStatSummary> = Object.fromEntries(
      updatedUsers.map((user) => [
        user.id,
        {
          gamesPlayed: user.gamesPlayed,
          gamesWon: user.gamesWon,
          winRate: user.gamesPlayed > 0 ? Math.round((user.gamesWon / user.gamesPlayed) * 100) : 0,
        },
      ]),
    );

    const payload = {
      winner,
      teamABooks: gameState.books.TEAM_A.length,
      teamBBooks: gameState.books.TEAM_B.length,
      scores: gameState.scores,
      gameStatus: "FINISHED",
      playerStats,
    };
    emitToRoomNamespace(roomCode, "game:over", payload);
    emitToGameNamespace(roomCode, "game:over", payload);
  },
  getNextTurnAfterEmpty(gameState: SnapshotState, emptyPlayerId: string): string | null {
    const emptyPlayer = gameState.players.find((player) => player.id === emptyPlayerId);
    if (!emptyPlayer) {
      return null;
    }

    const teammatesWithCards = gameState.players.filter(
      (player) =>
        player.team === emptyPlayer.team &&
        player.id !== emptyPlayerId &&
        ((gameState.handsSnapshot[player.id]?.length ?? 0) > 0),
    );

    if (teammatesWithCards.length > 0) {
      return teammatesWithCards[0].id;
    }

    return null;
  },
  checkGameOver(gameState: SnapshotState, lastDeclaredTeam?: TeamId): boolean {
    const totalBooks = Object.values(gameState.books).reduce((sum, books) => sum + books.length, 0);
    if (totalBooks >= 8) {
      return true;
    }

    const anyCardsLeft = gameState.players.some((player) => (gameState.handsSnapshot[player.id]?.length ?? 0) > 0);
    if (!anyCardsLeft) {
      return true;
    }

    const teamAHasCards = gameState.players
      .filter((player) => player.team === "TEAM_A")
      .some((player) => (gameState.handsSnapshot[player.id]?.length ?? 0) > 0);
    const teamBHasCards = gameState.players
      .filter((player) => player.team === "TEAM_B")
      .some((player) => (gameState.handsSnapshot[player.id]?.length ?? 0) > 0);
    if (!teamAHasCards || !teamBHasCards) {
      return true;
    }

    if (lastDeclaredTeam) {
      const declaringTeamHasCards = gameState.players
        .filter((player) => player.team === lastDeclaredTeam)
        .some((player) => (gameState.handsSnapshot[player.id]?.length ?? 0) > 0);
      if (!declaringTeamHasCards) {
        return true;
      }
    }

    return false;
  },
  resolveGameWinner(scores: Record<TeamId, number>): TeamId | "DRAW" {
    if ((scores.TEAM_A ?? 0) > (scores.TEAM_B ?? 0)) {
      return "TEAM_A";
    }
    if ((scores.TEAM_B ?? 0) > (scores.TEAM_A ?? 0)) {
      return "TEAM_B";
    }
    return "DRAW";
  },
  getOpponentTeam(team: TeamId): TeamId {
    return getOpponentTeam(team);
  },
};
