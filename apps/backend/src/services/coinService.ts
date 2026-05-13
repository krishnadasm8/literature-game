import { PrismaClient } from "@prisma/client";

import {
  COIN_LEAVE_GAME,
  COIN_LOSE_GAME,
  COIN_MAX_WALLET,
  COIN_REGEN_INTERVAL_HOURS,
  COIN_REGEN_PER_TICK,
  COIN_WIN_GAME,
} from "../config/coinEconomy";

const prisma = new PrismaClient();

const isBotUser = (googleId: string | null | undefined): boolean =>
  (googleId ?? "").startsWith("bot_");

export type TeamWinner = "TEAM_A" | "TEAM_B" | "DRAW";

const logTx = async (
  tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  userId: string,
  type: "EARN" | "SPEND",
  amount: number,
  description: string,
  referenceId?: string,
): Promise<void> => {
  if (amount <= 0) {
    return;
  }
  await tx.transaction.create({
    data: {
      userId,
      type,
      amount,
      description,
      referenceId,
    },
  });
};

const setCoinsClamped = async (
  tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  userId: string,
  nextCoins: number,
  description: string,
  referenceId: string,
  previousCoins: number,
  extraUserData?: { lastCoinRegenAt?: Date },
): Promise<void> => {
  const clamped = Math.max(0, nextCoins);
  await tx.user.update({
    where: { id: userId },
    data: { coins: clamped, ...(extraUserData ?? {}) },
  });
  const delta = clamped - previousCoins;
  if (delta > 0) {
    await logTx(tx, userId, "EARN", delta, description, referenceId);
  } else if (delta < 0) {
    await logTx(tx, userId, "SPEND", -delta, description, referenceId);
  }
};

/**
 * Time-based reward: for each full `COIN_REGEN_INTERVAL_HOURS` since `lastCoinRegenAt`, add `COIN_REGEN_PER_TICK`
 * until `COIN_MAX_WALLET`. Advances the clock so partial time is preserved.
 */
export async function applyPassiveCoinRegen(userId: string): Promise<void> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { coins: true, googleId: true, lastCoinRegenAt: true },
  });
  if (!u || isBotUser(u.googleId)) {
    return;
  }
  const intervalMs = COIN_REGEN_INTERVAL_HOURS * 3600 * 1000;
  const lastMs = u.lastCoinRegenAt.getTime();
  const elapsed = Date.now() - lastMs;
  const ticks = Math.floor(elapsed / intervalMs);
  if (ticks < 1) {
    return;
  }
  const potential = u.coins + ticks * COIN_REGEN_PER_TICK;
  const newCoins = Math.min(potential, COIN_MAX_WALLET);
  const granted = newCoins - u.coins;
  const newLast = new Date(lastMs + ticks * intervalMs);

  await prisma.$transaction(async (tx) => {
    if (granted > 0) {
      await setCoinsClamped(
        tx,
        userId,
        newCoins,
        `Idle reward (${ticks}×${COIN_REGEN_INTERVAL_HOURS}h)`,
        "regen",
        u.coins,
        { lastCoinRegenAt: newLast },
      );
    } else {
      await tx.user.update({
        where: { id: userId },
        data: { lastCoinRegenAt: newLast },
      });
    }
  });
}

/** Flat earn (e.g. room entry), capped at COIN_MAX_WALLET. */
export async function grantCoinBonus(
  userId: string,
  amount: number,
  description: string,
  referenceId: string,
): Promise<void> {
  if (amount <= 0) {
    return;
  }
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { coins: true, googleId: true },
  });
  if (!u || isBotUser(u.googleId)) {
    return;
  }
  const next = Math.min(u.coins + amount, COIN_MAX_WALLET);
  if (next <= u.coins) {
    return;
  }
  await prisma.$transaction(async (tx) => {
    await setCoinsClamped(tx, userId, next, description, referenceId, u.coins);
  });
}

/**
 * After a finished game: winners earn COIN_WIN_GAME, losers lose COIN_LOSE_GAME (floored at 0). Bots skipped. DRAW = no coin change.
 */
export async function applyGameEndCoins(
  roomCode: string,
  participants: Array<{ userId: string; team: "TEAM_A" | "TEAM_B" }>,
  winner: TeamWinner,
): Promise<void> {
  if (winner !== "TEAM_A" && winner !== "TEAM_B") {
    return;
  }

  const users = await prisma.user.findMany({
    where: { id: { in: participants.map((p) => p.userId) } },
    select: { id: true, googleId: true, coins: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  await prisma.$transaction(async (tx) => {
    for (const p of participants) {
      const u = userById.get(p.userId);
      if (!u || isBotUser(u.googleId)) {
        continue;
      }
      const won = p.team === winner;
      if (won) {
        await setCoinsClamped(
          tx,
          u.id,
          u.coins + COIN_WIN_GAME,
          `Game win (${roomCode})`,
          roomCode,
          u.coins,
        );
      } else {
        const loss = Math.min(COIN_LOSE_GAME, u.coins);
        await setCoinsClamped(
          tx,
          u.id,
          u.coins - loss,
          `Game loss (${roomCode})`,
          roomCode,
          u.coins,
        );
      }
    }
  });
}

/**
 * Mid-game leave: leaver pays up to COIN_LEAVE_GAME (capped by balance); split evenly among remaining human players.
 */
export async function applyLeaveGameCoins(
  roomCode: string,
  leaverId: string,
  recipientUserIds: string[],
): Promise<Record<string, number>> {
  const leaver = await prisma.user.findUnique({
    where: { id: leaverId },
    select: { id: true, googleId: true, coins: true },
  });
  if (!leaver || isBotUser(leaver.googleId)) {
    return {};
  }

  const humanRecipients = [...new Set(recipientUserIds)].filter((id) => id && id !== leaverId);
  const taken = Math.min(COIN_LEAVE_GAME, leaver.coins);
  if (taken <= 0) {
    return { [leaverId]: leaver.coins };
  }

  const updated: Record<string, number> = {};

  await prisma.$transaction(async (tx) => {
    await setCoinsClamped(
      tx,
      leaver.id,
      leaver.coins - taken,
      `Left game early (${roomCode})`,
      roomCode,
      leaver.coins,
    );
    updated[leaver.id] = Math.max(0, leaver.coins - taken);

    if (humanRecipients.length === 0) {
      return;
    }

    const base = Math.floor(taken / humanRecipients.length);
    let remainder = taken - base * humanRecipients.length;

    for (let i = 0; i < humanRecipients.length; i += 1) {
      const rid = humanRecipients[i]!;
      const ru = await tx.user.findUnique({
        where: { id: rid },
        select: { id: true, googleId: true, coins: true },
      });
      if (!ru || isBotUser(ru.googleId)) {
        continue;
      }
      const share = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) {
        remainder -= 1;
      }
      if (share <= 0) {
        updated[ru.id] = ru.coins;
        continue;
      }
      await setCoinsClamped(
        tx,
        ru.id,
        ru.coins + share,
        `Share from player leaving (${roomCode})`,
        roomCode,
        ru.coins,
      );
      const after = await tx.user.findUnique({ where: { id: ru.id }, select: { coins: true } });
      updated[ru.id] = after?.coins ?? ru.coins + share;
    }
  });

  const finalLeaver = await prisma.user.findUnique({ where: { id: leaverId }, select: { coins: true } });
  updated[leaverId] = finalLeaver?.coins ?? updated[leaverId] ?? 0;

  for (const rid of humanRecipients) {
    if (updated[rid] === undefined) {
      const r = await prisma.user.findUnique({ where: { id: rid }, select: { coins: true } });
      if (r) {
        updated[rid] = r.coins;
      }
    }
  }

  return updated;
}
