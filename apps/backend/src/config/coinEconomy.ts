/** Coin economy — override via env in production if needed. */

const parsePositive = (value: string | undefined, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};

export const COIN_STARTING = parsePositive(process.env.COIN_STARTING, 500);
export const COIN_WIN_GAME = parsePositive(process.env.COIN_WIN_GAME, 40);
export const COIN_LOSE_GAME = parsePositive(process.env.COIN_LOSE_GAME, 15);
/** Taken from leaver when quitting an in-progress match; split across remaining human players. */
export const COIN_LEAVE_GAME = parsePositive(process.env.COIN_LEAVE_GAME, 50);

/** Every N full hours since `lastCoinRegenAt`, grant `COIN_REGEN_PER_TICK` (until wallet cap). */
export const COIN_REGEN_INTERVAL_HOURS = parsePositive(process.env.COIN_REGEN_INTERVAL_HOURS, 24);
export const COIN_REGEN_PER_TICK = parsePositive(process.env.COIN_REGEN_PER_TICK, 50);
/** Wallet ceiling for passive regen + room bonuses (game win/loss still apply). */
export const COIN_MAX_WALLET = parsePositive(process.env.COIN_MAX_WALLET, 9999);

/** One-time reward when creating a lobby room (human only). */
export const COIN_ROOM_CREATE = parsePositive(process.env.COIN_ROOM_CREATE, 15);
/** One-time reward when joining a lobby room as a new seat (human only). */
export const COIN_ROOM_JOIN = parsePositive(process.env.COIN_ROOM_JOIN, 15);
