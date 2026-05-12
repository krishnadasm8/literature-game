import { PrismaClient } from "@prisma/client";
import { Router } from "express";

import type { AuthenticatedRequest } from "../middleware/auth.middleware";
import { authMiddleware } from "../middleware/auth.middleware";
import { emitToRoomNamespace } from "../sockets";
import { gameManager } from "../services/gameManager";

const router = Router();
const prisma = new PrismaClient();

type Team = "TEAM_A" | "TEAM_B";

type RoomWithPlayers = Awaited<ReturnType<typeof getRoomByCode>>;

const TEAM_FOR_SEAT: Record<number, Team> = {
  0: "TEAM_A",
  1: "TEAM_B",
  2: "TEAM_A",
  3: "TEAM_B",
  4: "TEAM_A",
  5: "TEAM_B",
  6: "TEAM_A",
  7: "TEAM_B",
};

const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const toPublicRoom = (room: NonNullable<RoomWithPlayers>) => {
  const players = [...room.players]
    .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())
    .map((roomPlayer, index) => ({
      id: roomPlayer.user.id,
      displayName: roomPlayer.user.displayName,
      avatarUrl: roomPlayer.user.avatarUrl,
      isReady: roomPlayer.isReady,
      isBot: (roomPlayer.user.googleId ?? "").startsWith("bot_"),
      team: roomPlayer.team ?? TEAM_FOR_SEAT[index] ?? "TEAM_A",
      seatNumber: index,
      joinedAt: roomPlayer.joinedAt,
    }));

  return {
    id: room.id,
    roomCode: room.roomCode,
    hostId: room.hostId,
    status: room.status,
    maxPlayers: room.maxPlayers,
    createdAt: room.createdAt,
    players,
  };
};

const getRoomByCode = async (roomCode: string) => {
  return prisma.room.findUnique({
    where: { roomCode },
    include: {
      players: {
        include: {
          user: true,
        },
      },
      game: true,
    },
  });
};

const generateRoomCode = async (): Promise<string> => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = Array.from({ length: 6 }, () => ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)]).join(
      "",
    );
    const exists = await prisma.room.findUnique({ where: { roomCode: code } });
    if (!exists) {
      return code;
    }
  }

  throw new Error("Unable to generate a unique room code.");
};

router.post("/", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const hostUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!hostUser) {
      res.status(401).json({
        error: "User not found. Sign in again — your token may be from an old deployment or database.",
      });
      return;
    }

    const maxPlayers = Number(req.body?.maxPlayers ?? 6);
    if (![4, 6, 8].includes(maxPlayers)) {
      res.status(400).json({ error: "maxPlayers must be 4, 6, or 8." });
      return;
    }

    const roomCode = await generateRoomCode();
    const room = await prisma.room.create({
      data: {
        roomCode,
        hostId: userId,
        maxPlayers,
        status: "WAITING",
        players: {
          create: {
            userId,
            isReady: true,
            team: TEAM_FOR_SEAT[0],
          },
        },
      },
    });

    const fullRoom = await getRoomByCode(room.roomCode);
    res.status(201).json({
      room: fullRoom ? toPublicRoom(fullRoom) : room,
      roomCode: room.roomCode,
    });
  } catch (error) {
    const prismaMeta =
      error && typeof error === "object" && "code" in error
        ? { prismaCode: String((error as { code: unknown }).code) }
        : {};
    console.error("[POST /api/v1/rooms] create failed:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to create room.",
      ...prismaMeta,
      hint:
        prismaMeta.prismaCode === "P2021" || prismaMeta.prismaCode === "P1001"
          ? "Check DATABASE_URL and run prisma migrate deploy on the server."
          : undefined,
    });
  }
});

router.get("/:code", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const roomCode = String(req.params.code).toUpperCase();
  const room = await getRoomByCode(roomCode);
  if (!room) {
    res.status(404).json({ error: "Room not found." });
    return;
  }
  res.status(200).json({ room: toPublicRoom(room) });
});

router.post("/:code/join", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const roomCode = String(req.params.code).toUpperCase();
    const room = await getRoomByCode(roomCode);
    if (!room) {
      res.status(404).json({ error: "Room not found." });
      return;
    }

    if (room.status !== "WAITING") {
      res.status(400).json({ error: "Room is not joinable." });
      return;
    }

    if (room.players.length >= room.maxPlayers) {
      res.status(400).json({ error: "Room is full." });
      return;
    }

    const existing = room.players.find((player: any) => player.userId === userId);
    if (!existing) {
      const seatIndex = room.players.length;
      await prisma.roomPlayer.create({
        data: {
          roomId: room.id,
          userId,
          isReady: room.hostId === userId,
          team: TEAM_FOR_SEAT[seatIndex],
        },
      });
    } else if (room.hostId === userId && !existing.isReady) {
      await prisma.roomPlayer.update({
        where: { id: existing.id },
        data: { isReady: true },
      });
    }

    const updatedRoom = await getRoomByCode(roomCode);
    if (!updatedRoom) {
      res.status(500).json({ error: "Room disappeared after join." });
      return;
    }

    res.status(200).json({ room: toPublicRoom(updatedRoom) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to join room." });
  }
});

router.post("/:code/leave", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const roomCode = String(req.params.code).toUpperCase();
    const room = await getRoomByCode(roomCode);
    if (!room) {
      res.status(404).json({ error: "Room not found." });
      return;
    }

    const roomPlayer = room.players.find((player: any) => player.userId === userId);
    if (!roomPlayer) {
      res.status(200).json({ room: toPublicRoom(room) });
      return;
    }

    await prisma.roomPlayer.delete({ where: { id: roomPlayer.id } });
    const updatedRoom = await getRoomByCode(roomCode);
    if (!updatedRoom) {
      res.status(500).json({ error: "Failed to refresh room." });
      return;
    }
    res.status(200).json({ room: toPublicRoom(updatedRoom) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to leave room." });
  }
});

router.post("/:code/ready", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const roomCode = String(req.params.code).toUpperCase();
    const room = await getRoomByCode(roomCode);
    if (!room) {
      res.status(404).json({ error: "Room not found." });
      return;
    }

    const isReady = Boolean(req.body?.isReady);
    const roomPlayer = room.players.find((player: any) => player.userId === userId);
    if (!roomPlayer) {
      res.status(404).json({ error: "Player not in room." });
      return;
    }

    await prisma.roomPlayer.update({
      where: { id: roomPlayer.id },
      data: { isReady },
    });

    const updatedRoom = await getRoomByCode(roomCode);
    if (!updatedRoom) {
      res.status(500).json({ error: "Failed to refresh room." });
      return;
    }

    emitToRoomNamespace(roomCode, "room:player_ready", {
      roomCode,
      playerId: userId,
      isReady,
    });

    res.status(200).json({ room: toPublicRoom(updatedRoom) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update readiness." });
  }
});

router.patch("/:code/team", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const roomCode = String(req.params.code).toUpperCase();
    const requestedTeam = String(req.body?.team ?? "").toUpperCase();
    if (requestedTeam !== "TEAM_A" && requestedTeam !== "TEAM_B") {
      res.status(400).json({ error: "team must be TEAM_A or TEAM_B." });
      return;
    }

    const room = await getRoomByCode(roomCode);
    if (!room) {
      res.status(404).json({ error: "Room not found." });
      return;
    }

    if (room.status !== "WAITING") {
      res.status(400).json({ error: "Teams can only be changed while room is waiting." });
      return;
    }

    const roomPlayer = room.players.find((player: any) => player.userId === userId);
    if (!roomPlayer) {
      res.status(404).json({ error: "Player not in room." });
      return;
    }

    const nextTeam = requestedTeam as Team;
    if (roomPlayer.team !== nextTeam) {
      await prisma.roomPlayer.update({
        where: { id: roomPlayer.id },
        data: { team: nextTeam },
      });
    }

    const updatedRoom = await getRoomByCode(roomCode);
    if (!updatedRoom) {
      res.status(500).json({ error: "Failed to refresh room." });
      return;
    }

    emitToRoomNamespace(roomCode, "room:team_changed", {
      roomCode,
      playerId: userId,
      team: nextTeam,
    });

    res.status(200).json({ room: toPublicRoom(updatedRoom) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to switch team." });
  }
});

router.post("/:code/start", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const roomCode = String(req.params.code).toUpperCase();
    const room = await getRoomByCode(roomCode);
    if (!room) {
      res.status(404).json({ error: "Room not found." });
      return;
    }

    if (room.hostId !== userId) {
      res.status(403).json({ error: "Only host can start the game." });
      return;
    }

    if (![4, 6, 8].includes(room.players.length) || room.players.length % 2 !== 0) {
      res.status(400).json({ error: "Player count must be 4, 6, or 8 and even." });
      return;
    }

    const nonBotPlayers = room.players.filter((player: any) => !(player.user.googleId ?? "").startsWith("bot_"));
    if (nonBotPlayers.some((player: any) => !player.isReady)) {
      res.status(400).json({ error: "All non-bot players must be ready." });
      return;
    }

    if (room.players.length < room.maxPlayers) {
      const missing = room.maxPlayers - room.players.length;
      for (let i = 0; i < missing; i += 1) {
        const seat = room.players.length + i;
        const botUser = await prisma.user.create({
          data: {
            googleId: `bot_${room.roomCode}_${seat}_${Date.now()}`,
            displayName: `Bot ${seat + 1}`,
            avatarUrl: null,
          },
        });
        await prisma.roomPlayer.create({
          data: {
            roomId: room.id,
            userId: botUser.id,
            isReady: true,
            team: TEAM_FOR_SEAT[seat],
          },
        });
      }
    }

    const finalizedRoom = await getRoomByCode(roomCode);
    if (!finalizedRoom) {
      res.status(500).json({ error: "Failed to finalize room before start." });
      return;
    }

    if (finalizedRoom.game) {
      res.status(400).json({ error: "Game already started for this room." });
      return;
    }

    const game = await gameManager.createGame({
      roomId: finalizedRoom.id,
      roomPlayerUserIds: [...finalizedRoom.players]
        .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())
        .map((player: any) => player.userId),
    });

    await prisma.room.update({
      where: { id: finalizedRoom.id },
      data: { status: "IN_PROGRESS" },
    });

    const startedRoom = await getRoomByCode(roomCode);
    if (!startedRoom) {
      res.status(500).json({ error: "Failed to fetch started room." });
      return;
    }

    const orderedPlayers = [...startedRoom.players].sort(
      (a, b) => a.joinedAt.getTime() - b.joinedAt.getTime(),
    );
    const handsSnapshot = ((((startedRoom.game as any)?.handsSnapshot ?? {}) as Record<string, unknown[]>));
    const fallbackTurnPlayerId = orderedPlayers[0]?.userId ?? "";
    const gameState = {
      id: game.id,
      roomId: startedRoom.id,
      status: "PLAYING",
      currentTurnPlayerId: game.currentTurnPlayerId ?? fallbackTurnPlayerId,
      players: orderedPlayers.map((roomPlayer, index) => ({
        id: roomPlayer.user.id,
        displayName: roomPlayer.user.displayName,
        avatarUrl: roomPlayer.user.avatarUrl ?? "",
        team: roomPlayer.team ?? TEAM_FOR_SEAT[index],
        handCount: (handsSnapshot[roomPlayer.user.id] ?? []).length,
        isBot: (roomPlayer.user.googleId ?? "").startsWith("bot_"),
        isConnected: true,
      })),
      scores: {
        TEAM_A: 0,
        TEAM_B: 0,
      },
      books: {
        TEAM_A: [],
        TEAM_B: [],
      },
      lastMove: undefined,
      round: 1,
    };

    emitToRoomNamespace(roomCode, "room:game_starting", {
      roomCode,
      gameId: game.id,
      gameState,
    });

    res.status(200).json({ room: toPublicRoom(startedRoom) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to start game." });
  }
});

export default router;
