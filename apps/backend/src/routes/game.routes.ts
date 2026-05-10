import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import type { AuthenticatedRequest } from "../middleware/auth.middleware";
import { authMiddleware } from "../middleware/auth.middleware";
import type { Card } from "../engine/deck";
import { emitToGameNamespace, emitToRoomNamespace } from "../sockets";
import { gameManager } from "../services/gameManager";

const router = Router();
const prisma = new PrismaClient();

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

    const targetPlayerId = req.body?.targetPlayerId as string | undefined;
    const card = req.body?.card as Card | undefined;
    if (!targetPlayerId || !card) {
      res.status(400).json({ error: "targetPlayerId and card are required." });
      return;
    }

    const result = await gameManager.processAsk(String(req.params.id), userId, targetPlayerId, card);
    const gameRecord = await prisma.game.findFirst({
      where: {
        OR: [{ id: String(req.params.id) }, { room: { roomCode: String(req.params.id).toUpperCase() } }],
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
    if (!gameRecord) {
      res.status(404).json({ error: "Game not found." });
      return;
    }

    const requesterState = await gameManager.getGameState({
      gameIdOrRoomCode: gameRecord.id,
      requestingPlayerId: userId,
    });
    if (!requesterState) {
      res.status(500).json({ error: "Failed to fetch updated game state." });
      return;
    }
    const { gameState: publicState } = requesterState;

    emitToRoomNamespace(result.roomCode, "game:state_update", {
      gameState: publicState,
      myHand: undefined,
    });
    emitToGameNamespace(result.roomCode, "game:state_update", {
      gameState: publicState,
      myHand: undefined,
    });

    const roomPlayers = [...gameRecord.room.players].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
    for (const roomPlayer of roomPlayers) {
      const playerState = await gameManager.getGameState({
        gameIdOrRoomCode: gameRecord.id,
        requestingPlayerId: roomPlayer.userId,
      });
      emitToGameNamespace(roomPlayer.userId, "game:hand_update", {
        hand: playerState?.myHand ?? [],
      });
    }

    if (result.isGameOver && result.winner) {
      await gameManager.emitGameOver(result.roomCode, result.newState, result.winner);
    }

    res.status(200).json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to process ask." });
  }
});

router.post("/:id/declare", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const halfSuit = req.body?.halfSuit as string | undefined;
    if (!halfSuit) {
      res.status(400).json({ error: "halfSuit is required." });
      return;
    }

    const result = await gameManager.processDeclare(String(req.params.id), userId, halfSuit);
    const gameRecord = await prisma.game.findFirst({
      where: {
        OR: [{ id: String(req.params.id) }, { room: { roomCode: String(req.params.id).toUpperCase() } }],
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
    if (!gameRecord) {
      res.status(404).json({ error: "Game not found." });
      return;
    }

    const requesterState = await gameManager.getGameState({
      gameIdOrRoomCode: gameRecord.id,
      requestingPlayerId: userId,
    });
    if (!requesterState) {
      res.status(500).json({ error: "Failed to fetch updated game state." });
      return;
    }
    emitToRoomNamespace(result.roomCode, "game:state_update", {
      gameState: requesterState.gameState,
      myHand: undefined,
    });
    emitToGameNamespace(result.roomCode, "game:state_update", {
      gameState: requesterState.gameState,
      myHand: undefined,
    });

    const roomPlayers = [...gameRecord.room.players].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
    for (const roomPlayer of roomPlayers) {
      const playerState = await gameManager.getGameState({
        gameIdOrRoomCode: gameRecord.id,
        requestingPlayerId: roomPlayer.userId,
      });
      emitToGameNamespace(roomPlayer.userId, "game:hand_update", {
        hand: playerState?.myHand ?? [],
      });
    }

    if (result.isGameOver && result.winner) {
      await gameManager.emitGameOver(result.roomCode, result.newState, result.winner);
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to process declare." });
  }
});

router.post("/:id/forfeit", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const game = await prisma.game.findFirst({
      where: {
        OR: [{ id: String(req.params.id) }, { room: { roomCode: String(req.params.id).toUpperCase() } }],
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
      res.status(404).json({ error: "Game not found." });
      return;
    }

    const players = [...game.room.players].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
    const handsSnapshot = (((game as any).handsSnapshot ?? {}) as Record<string, Card[]>);
    const currentIndex = players.findIndex((player) => player.userId === game.currentTurnPlayerId);
    const nextPlayer = players
      .slice(currentIndex + 1)
      .concat(players.slice(0, currentIndex + 1))
      .find((player) => player.userId !== userId && (handsSnapshot[player.userId]?.length ?? 0) > 0);

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

    const updatedForCurrent = await gameManager.getGameState({
      gameIdOrRoomCode: game.id,
      requestingPlayerId: userId,
    });

    emitToGameNamespace(game.room.roomCode, "game:state_update", {
      gameState: updatedForCurrent?.gameState,
      myHand: undefined,
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to forfeit turn." });
  }
});

router.post("/:id/timeout", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const game = await prisma.game.findFirst({
      where: {
        OR: [{ id: String(req.params.id) }, { room: { roomCode: String(req.params.id).toUpperCase() } }],
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
      res.status(404).json({ error: "Game not found." });
      return;
    }

    if (game.currentTurnPlayerId !== userId) {
      res.status(400).json({ error: "Only current turn player can timeout pass." });
      return;
    }

    const players = [...game.room.players].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
    const handsSnapshot = (((game as any).handsSnapshot ?? {}) as Record<string, Card[]>);
    const currentIndex = players.findIndex((player) => player.userId === game.currentTurnPlayerId);
    const nextPlayer = players
      .slice(currentIndex + 1)
      .concat(players.slice(0, currentIndex + 1))
      .find((player) => (handsSnapshot[player.userId]?.length ?? 0) > 0);
    if (!nextPlayer) {
      res.status(400).json({ error: "No eligible player to pass turn." });
      return;
    }

    await prisma.game.update({
      where: { id: game.id },
      data: { currentTurnPlayerId: nextPlayer.userId },
    });

    const updatedState = await gameManager.getGameState({
      gameIdOrRoomCode: game.id,
      requestingPlayerId: userId,
    });
    emitToGameNamespace(game.room.roomCode, "game:state_update", {
      gameState: updatedState?.gameState,
      myHand: undefined,
    });

    res.status(200).json({
      ok: true,
      currentTurnPlayerId: nextPlayer.userId,
      currentTurnPlayerName: nextPlayer.user.displayName,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to timeout turn." });
  }
});

export default router;
