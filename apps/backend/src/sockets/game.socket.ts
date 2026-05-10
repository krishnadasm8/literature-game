import type { Namespace } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { verifyToken } from "../utils/jwt";
import { gameManager } from "../services/gameManager";

const prisma = new PrismaClient();

export const attachGameNamespace = (namespace: Namespace): void => {
  const socketRooms = new Map<string, Set<string>>();

  namespace.on("connection", (socket) => {
    const rawToken = socket.handshake.auth?.token as string | undefined;
    let userId: string | null = null;

    if (rawToken) {
      try {
        const decoded = verifyToken(rawToken);
        userId = decoded.userId ?? decoded.sub ?? null;
        if (userId) {
          socket.join(userId);
        }
      } catch {
        socket.emit("game:error", { message: "Invalid auth token." });
      }
    }

    socketRooms.set(socket.id, new Set<string>());

    socket.on("game:join", (payload: { roomCode?: string }) => {
      if (!userId) {
        socket.emit("game:error", { message: "Unauthorized socket." });
        return;
      }

      const roomCode = payload?.roomCode?.toUpperCase();
      if (!roomCode) {
        socket.emit("game:error", { message: "Missing room code." });
        return;
      }

      socket.join(roomCode);
      socketRooms.get(socket.id)?.add(roomCode);
    });

    socket.on("game:leave", (payload: { roomCode?: string }) => {
      const roomCode = payload?.roomCode?.toUpperCase();
      if (!roomCode) {
        return;
      }
      socket.leave(roomCode);
      socketRooms.get(socket.id)?.delete(roomCode);
    });

    socket.on("game:play_card", async (payload: { roomCode?: string; gameId?: string; targetPlayerId?: string; card?: any }) => {
      if (!userId) {
        socket.emit("game:error", { message: "Unauthorized socket." });
        return;
      }
      if (!payload?.targetPlayerId || !payload?.card) {
        socket.emit("game:error", { message: "targetPlayerId and card are required." });
        return;
      }
      try {
        const result = await gameManager.processAsk(
          payload.gameId ?? payload.roomCode ?? "",
          userId,
          payload.targetPlayerId,
          payload.card,
        );
        const requesterState = await gameManager.getGameState({
          gameIdOrRoomCode: payload.gameId ?? payload.roomCode ?? "",
          requestingPlayerId: userId,
        });
        const askingPlayerName =
          requesterState?.gameState.players.find((player) => player.id === userId)?.displayName ?? "";
        const targetPlayerName =
          requesterState?.gameState.players.find((player) => player.id === payload.targetPlayerId)?.displayName ?? "";
        const { hands, ...publicState } = result.newState as any;
        namespace.to(result.roomCode).emit("game:state_update", {
          gameState: requesterState?.gameState ?? publicState,
        });
        for (const playerId of Object.keys(hands ?? {})) {
          namespace.to(playerId).emit("game:hand_update", { hand: hands[playerId] ?? [] });
        }
        if (!askingPlayerName || !targetPlayerName) {
          socket.emit("game:error", { message: "Failed to resolve ask player names." });
          return;
        }
        namespace.to(result.roomCode).emit("game:ask_resolved", {
          success: result.success,
          targetHadCard: result.targetHadCard,
          card: payload.card,
          cardName: result.cardName,
          askingPlayerId: userId,
          targetPlayerName,
          targetPlayerId: payload.targetPlayerId,
          askingPlayerName,
          nextTurnPlayerId: result.nextTurnPlayerId,
        });
        if (result.isGameOver && result.winner) {
          await gameManager.emitGameOver(result.roomCode, result.newState, result.winner);
        }
      } catch (error) {
        socket.emit("game:error", { message: error instanceof Error ? error.message : "Failed to process ask." });
      }
    });

    socket.on("game:declare", async (payload: {
      roomCode?: string;
      gameId?: string;
      halfSuit?: string
    }) => {
      console.log("=== DECLARE START ===");
      console.log("userId:", userId);
      console.log("payload:", JSON.stringify(payload));

      if (!userId) {
        console.log("DECLARE FAILED: no userId");
        socket.emit("game:error", { message: "Unauthorized socket." });
        return;
      }

      if (!payload?.halfSuit) {
        console.log("DECLARE FAILED: no halfSuit");
        socket.emit("game:error", { message: "halfSuit is required." });
        return;
      }

      const gameIdOrCode = payload.gameId ?? payload.roomCode ?? "";
      console.log("gameIdOrCode:", gameIdOrCode);

      try {
        console.log("calling processDeclare...");
        const result = await gameManager.processDeclare(
          gameIdOrCode,
          userId,
          payload.halfSuit
        );
        console.log("processDeclare success:", {
          correct: result.correct,
          winningTeam: result.winningTeam,
          roomCode: result.roomCode,
          isGameOver: result.isGameOver,
        });

        const requesterState = await gameManager.getGameState({
          gameIdOrRoomCode: gameIdOrCode,
          requestingPlayerId: userId,
        });
        const { hands, ...publicState } = result.newState as any;

        console.log("emitting game:state_update to room:", result.roomCode);
        namespace.to(result.roomCode).emit("game:state_update", {
          gameState: requesterState?.gameState ?? publicState
        });

        for (const playerId of Object.keys(hands ?? {})) {
          namespace.to(playerId).emit("game:hand_update", {
            hand: hands[playerId] ?? []
          });
        }

        const declaringPlayerName =
          requesterState?.gameState.players
            .find((p) => p.id === userId)?.displayName ?? "Player";

        const declarePayload = {
          correct: result.correct,
          halfSuit: payload.halfSuit,
          winningTeam: result.winningTeam,
          declaringPlayerId: userId,
          declaringPlayerName,
          ranOutOfCards: result.ranOutOfCards,
          nextTurnPlayerId: result.nextTurnPlayerId,
        };

        console.log("emitting game:declare_result:", declarePayload);
        namespace.to(result.roomCode).emit("game:declare_result", declarePayload);

        if (result.isGameOver && result.winner) {
          console.log("Game over! Winner:", result.winner);
          await gameManager.emitGameOver(
            result.roomCode,
            result.newState,
            result.winner
          );
        }

        console.log("=== DECLARE END SUCCESS ===");

      } catch (error) {
        const msg = error instanceof Error
          ? error.message
          : String(error);
        const stack = error instanceof Error
          ? error.stack
          : "no stack";
        console.error("=== DECLARE ERROR ===");
        console.error("message:", msg);
        console.error("stack:", stack);
        console.error("=== END DECLARE ERROR ===");
        socket.emit("game:error", { message: msg });
      }
    });

    socket.on("game:forfeit", async (payload: { roomCode?: string; gameId?: string }) => {
      if (!payload?.roomCode && !payload?.gameId) {
        socket.emit("game:error", { message: "roomCode or gameId is required." });
        return;
      }
      try {
        const game = await prisma.game.findFirst({
          where: {
            OR: [{ id: payload.gameId ?? "" }, { room: { roomCode: (payload.roomCode ?? "").toUpperCase() } }],
          },
          include: {
            room: {
              include: {
                players: true,
              },
            },
          },
        });
        if (!game) {
          socket.emit("game:error", { message: "Game not found." });
          return;
        }
        const handsSnapshot = (((game as any).handsSnapshot ?? {}) as Record<string, any[]>);
        const players = [...game.room.players].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
        const currentIndex = players.findIndex((player) => player.userId === game.currentTurnPlayerId);
        const nextPlayer = players
          .slice(currentIndex + 1)
          .concat(players.slice(0, currentIndex + 1))
          .find((player) => (handsSnapshot[player.userId]?.length ?? 0) > 0);
        if (!nextPlayer) {
          socket.emit("game:error", { message: "No next player found." });
          return;
        }
        await prisma.game.update({
          where: { id: game.id },
          data: { currentTurnPlayerId: nextPlayer.userId },
        });
        const refreshed = await gameManager.getGameState({
          gameIdOrRoomCode: game.id,
          requestingPlayerId: userId ?? "",
        });
        namespace.to(payload.roomCode ?? "").emit("game:state_update", {
          gameState: refreshed?.gameState,
        });
      } catch (error) {
        socket.emit("game:error", { message: error instanceof Error ? error.message : "Failed to forfeit turn." });
      }
    });

    socket.on("game:sync", async (payload: { roomCode?: string; gameId?: string }) => {
      if (!userId) {
        socket.emit("game:error", { message: "Unauthorized socket." });
        return;
      }
      try {
        const state = await gameManager.getGameState({
          gameIdOrRoomCode: payload?.gameId ?? payload?.roomCode ?? "",
          requestingPlayerId: userId,
        });
        if (!state) {
          socket.emit("game:error", { message: "Game not found." });
          return;
        }
        socket.emit("game:state_update", state);
      } catch (error) {
        socket.emit("game:error", { message: error instanceof Error ? error.message : "Failed to sync game." });
      }
    });

    socket.on("disconnect", () => {
      socketRooms.delete(socket.id);
    });
  });
};
