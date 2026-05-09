export const getNextTurn = (
  playerOrder: string[],
  currentTurnPlayerId: string,
  activePlayerIds: string[] = playerOrder,
): string | null => {
  if (playerOrder.length === 0) {
    return null;
  }

  const activeSet = new Set(activePlayerIds);
  if (activeSet.size === 0) {
    return null;
  }

  const startIndex = Math.max(playerOrder.indexOf(currentTurnPlayerId), 0);
  for (let step = 1; step <= playerOrder.length; step += 1) {
    const nextIndex = (startIndex + step) % playerOrder.length;
    const nextPlayerId = playerOrder[nextIndex];
    if (activeSet.has(nextPlayerId)) {
      return nextPlayerId;
    }
  }

  return null;
};

export const getTurnDeadline = (
  turnTimeoutSeconds: number,
  fromTime: Date = new Date(),
): Date => {
  if (turnTimeoutSeconds <= 0) {
    throw new Error("turnTimeoutSeconds must be greater than 0.");
  }

  return new Date(fromTime.getTime() + turnTimeoutSeconds * 1000);
};
