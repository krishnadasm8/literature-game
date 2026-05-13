import { PrismaClient } from "@prisma/client";
import { Router } from "express";

import { isValidAvatarPreset, presetAvatarUrl } from "../config/avatarPresets";
import type { AuthenticatedRequest } from "../middleware/auth.middleware";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();
const prisma = new PrismaClient();

const userSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
  avatarPreset: true,
  gamesPlayed: true,
  gamesWon: true,
  coins: true,
} as const;

type UserRow = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  avatarPreset: number | null;
  gamesPlayed: number;
  gamesWon: number;
  coins: number;
};

function withWinRate(u: UserRow) {
  const winRate = u.gamesPlayed > 0 ? Math.round((u.gamesWon / u.gamesPlayed) * 100) : 0;
  return {
    id: u.id,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    avatarPreset: u.avatarPreset,
    gamesPlayed: u.gamesPlayed,
    gamesWon: u.gamesWon,
    winRate,
    coins: u.coins,
  };
}

function validDisplayName(s: string): boolean {
  const t = s.trim();
  return t.length >= 1 && t.length <= 15 && /^[a-zA-Z0-9 ]+$/.test(t);
}

function formatDisplayName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

router.get("/me", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });
    if (!u) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    res.status(200).json({ user: withWinRate(u) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load profile." });
  }
});

router.patch("/me", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const body = req.body as {
      displayName?: unknown;
      avatarPreset?: unknown;
    };

    const data: {
      displayName?: string;
      avatarUrl?: string | null;
      avatarPreset?: number | null;
    } = {};

    if (typeof body.displayName === "string") {
      const raw = body.displayName.trim();
      if (!validDisplayName(raw)) {
        res.status(400).json({ error: "displayName must be 1–15 letters, numbers, or spaces." });
        return;
      }
      data.displayName = formatDisplayName(raw);
    }

    if ("avatarPreset" in body) {
      const ap = body.avatarPreset;
      if (ap === null) {
        data.avatarPreset = null;
        data.avatarUrl = null;
      } else if (typeof ap === "number" && isValidAvatarPreset(ap)) {
        data.avatarPreset = ap;
        data.avatarUrl = presetAvatarUrl(ap);
      } else {
        res.status(400).json({ error: "avatarPreset must be an integer 1–8, or null to use Google photo on next sign-in." });
        return;
      }
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "Provide displayName and/or avatarPreset." });
      return;
    }

    const u = await prisma.user.update({
      where: { id: userId },
      data,
      select: userSelect,
    });

    res.status(200).json({ user: withWinRate(u) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update profile." });
  }
});

export default router;
