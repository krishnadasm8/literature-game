import { cardToCode, codeToCard, getHalfSuitCards, type Card, type HalfSuit } from "./deck";

export type Team = "TEAM_A" | "TEAM_B";
export type GameStatus = "WAITING" | "PLAYING" | "FINISHED";

export interface PlayerState {
  id: string;
  team: Team;
  handCount: number;
  isConnected: boolean;
}

export interface MoveRecord {
  id: string;
  gameId: string;
  playerId: string;
  type: "ASK" | "DECLARE";
  card?: Card;
  targetPlayerId?: string;
  declaredSet?: HalfSuit;
  success: boolean;
  timestamp: string;
}

export interface GameState {
  id: string;
  roomId: string;
  status: GameStatus;
  currentTurnPlayerId: string;
  players: PlayerState[];
  hands: Record<string, Card[]>;
  scores: Record<Team, number>;
  books: Record<Team, HalfSuit[]>;
  lastMove?: MoveRecord;
  round: number;
  lastDeclaredTeam?: Team;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface Declaration {
  halfSuit: HalfSuit;
  cardHolders: Record<string, string>;
}

export interface ValidMoves {
  canAsk: boolean;
  askableCards: Card[];
  declarableHalfSuits: HalfSuit[];
}

const TEAM_IDS: Team[] = ["TEAM_A", "TEAM_B"];
const HALF_SUITS: HalfSuit[] = [
  "LOW_HEARTS",
  "HIGH_HEARTS",
  "LOW_DIAMONDS",
  "HIGH_DIAMONDS",
  "LOW_CLUBS",
  "HIGH_CLUBS",
  "LOW_SPADES",
  "HIGH_SPADES",
];

const cloneHands = (hands: Record<string, Card[]>): Record<string, Card[]> => {
  return Object.fromEntries(Object.entries(hands).map(([playerId, cards]) => [playerId, [...cards]]));
};

const updateHandCounts = (
  players: PlayerState[],
  hands: Record<string, Card[]>,
): PlayerState[] => {
  return players.map((player) => ({
    ...player,
    handCount: hands[player.id]?.length ?? 0,
  }));
};

const getPlayer = (gameState: GameState, playerId: string): PlayerState | undefined => {
  return gameState.players.find((player) => player.id === playerId);
};

const getOpponentTeam = (team: Team): Team => (team === "TEAM_A" ? "TEAM_B" : "TEAM_A");

const hasExactCard = (hand: Card[], card: Card): boolean => {
  const code = cardToCode(card);
  return hand.some((ownedCard) => cardToCode(ownedCard) === code);
};

const removeExactCard = (hand: Card[], card: Card): Card[] => {
  const cardCode = cardToCode(card);
  let removed = false;

  return hand.filter((ownedCard) => {
    if (!removed && cardToCode(ownedCard) === cardCode) {
      removed = true;
      return false;
    }
    return true;
  });
};

const getTeamPlayerIds = (gameState: GameState, team: Team): string[] => {
  return gameState.players.filter((player) => player.team === team).map((player) => player.id);
};

const teamHasAnyCardFromHalfSuit = (gameState: GameState, team: Team, halfSuit: HalfSuit): boolean => {
  const playerIds = getTeamPlayerIds(gameState, team);
  return playerIds.some((playerId) =>
    (gameState.hands[playerId] ?? []).some((card) => card.halfSuit === halfSuit),
  );
};

const getActualHalfSuitHolders = (
  gameState: GameState,
  halfSuit: HalfSuit,
): Record<string, string> => {
  const cards = getHalfSuitCards(halfSuit);
  const holderMap: Record<string, string> = {};

  for (const player of gameState.players) {
    const hand = gameState.hands[player.id] ?? [];
    for (const card of hand) {
      if (card.halfSuit === halfSuit) {
        holderMap[cardToCode(card)] = player.id;
      }
    }
  }

  for (const card of cards) {
    const code = cardToCode(card);
    if (!holderMap[code]) {
      holderMap[code] = "";
    }
  }

  return holderMap;
};

const selectNextTurnFromTeam = (gameState: GameState, team: Team): string => {
  const teamPlayers = gameState.players.filter((player) => player.team === team);
  const withCards = teamPlayers.find((player) => (gameState.hands[player.id] ?? []).length > 0);
  return (withCards ?? teamPlayers[0] ?? gameState.players[0]).id;
};

export const getNextTurnAfterEmpty = (
  gameState: Pick<GameState, "players" | "hands">,
  emptyPlayerId: string,
): string | null => {
  const emptyPlayer = gameState.players.find((player) => player.id === emptyPlayerId);
  if (!emptyPlayer) {
    return null;
  }

  const teammatesWithCards = gameState.players.filter(
    (player) =>
      player.team === emptyPlayer.team &&
      player.id !== emptyPlayerId &&
      ((gameState.hands[player.id] ?? []).length > 0),
  );

  if (teammatesWithCards.length > 0) {
    return teammatesWithCards[0].id;
  }

  return null;
};

export const isValidAsk = (
  gameState: GameState,
  askingPlayerId: string,
  targetPlayerId: string,
  card: Card,
): ValidationResult => {
  if (isGameOver(gameState)) {
    return { valid: false, reason: "Game is already over." };
  }

  if (gameState.currentTurnPlayerId !== askingPlayerId) {
    return { valid: false, reason: "It is not the asking player's turn." };
  }

  const askingPlayer = getPlayer(gameState, askingPlayerId);
  const targetPlayer = getPlayer(gameState, targetPlayerId);

  if (!askingPlayer || !targetPlayer) {
    return { valid: false, reason: "Unknown player id." };
  }

  if (askingPlayer.team === targetPlayer.team) {
    return { valid: false, reason: "You can only ask an opponent." };
  }

  const askingHand = gameState.hands[askingPlayerId] ?? [];
  const targetHand = gameState.hands[targetPlayerId] ?? [];

  if (!askingHand.some((ownedCard) => ownedCard.halfSuit === card.halfSuit)) {
    return { valid: false, reason: "Asking player must hold a card from the same half-suit." };
  }

  if (hasExactCard(askingHand, card)) {
    return { valid: false, reason: "Asking player already has that exact card." };
  }

  if (targetHand.length === 0 || !targetPlayer.isConnected) {
    return { valid: false, reason: "Target player is not currently active in the game." };
  }

  return { valid: true };
};

export const isValidDeclare = (
  gameState: GameState,
  declaringPlayerId: string,
  declaration: Declaration,
): ValidationResult => {
  if (isGameOver(gameState)) {
    return { valid: false, reason: "Game is already over." };
  }

  if (gameState.currentTurnPlayerId !== declaringPlayerId) {
    return { valid: false, reason: "It is not the declaring player's turn." };
  }

  const declaringPlayer = getPlayer(gameState, declaringPlayerId);
  if (!declaringPlayer) {
    return { valid: false, reason: "Unknown declaring player." };
  }

  if (!teamHasAnyCardFromHalfSuit(gameState, declaringPlayer.team, declaration.halfSuit)) {
    return { valid: false, reason: "Declaring team must hold at least one card from that half-suit." };
  }

  const requiredCards = getHalfSuitCards(declaration.halfSuit).map((card) => cardToCode(card));
  for (const code of requiredCards) {
    if (!declaration.cardHolders[code]) {
      return { valid: false, reason: "Declaration must include all 6 cards of the half-suit." };
    }
  }

  for (const playerId of Object.values(declaration.cardHolders)) {
    const player = getPlayer(gameState, playerId);
    if (!player || player.team !== declaringPlayer.team) {
      return { valid: false, reason: "All named holders must be on the declaring player's team." };
    }
  }

  return { valid: true };
};

export const applyAsk = (
  gameState: GameState,
  askingPlayerId: string,
  targetPlayerId: string,
  card: Card,
): GameState => {
  const validation = isValidAsk(gameState, askingPlayerId, targetPlayerId, card);
  if (!validation.valid) {
    throw new Error(validation.reason ?? "Invalid ask.");
  }

  const nextHands = cloneHands(gameState.hands);
  const targetHand = nextHands[targetPlayerId] ?? [];
  const targetHasCard = hasExactCard(targetHand, card);

  if (targetHasCard) {
    nextHands[targetPlayerId] = removeExactCard(targetHand, card);
    nextHands[askingPlayerId] = [...(nextHands[askingPlayerId] ?? []), card];
  }

  const candidateTurnPlayerId = targetHasCard ? askingPlayerId : targetPlayerId;
  const resolvedTurnPlayerId =
    (nextHands[candidateTurnPlayerId] ?? []).length > 0
      ? candidateTurnPlayerId
      : (getNextTurnAfterEmpty(
          {
            players: gameState.players,
            hands: nextHands,
          },
          candidateTurnPlayerId,
        ) ?? candidateTurnPlayerId);

  const nextState: GameState = {
    ...gameState,
    hands: nextHands,
    players: updateHandCounts(gameState.players, nextHands),
    currentTurnPlayerId: resolvedTurnPlayerId,
    lastMove: {
      id: `move-${Date.now()}`,
      gameId: gameState.id,
      playerId: askingPlayerId,
      type: "ASK",
      card,
      targetPlayerId,
      success: targetHasCard,
      timestamp: new Date().toISOString(),
    },
  };

  return nextState;
};

export const applyDeclare = (
  gameState: GameState,
  declaringPlayerId: string,
  declaration: Declaration,
): GameState => {
  const validation = isValidDeclare(gameState, declaringPlayerId, declaration);
  if (!validation.valid) {
    throw new Error(validation.reason ?? "Invalid declaration.");
  }

  const declaringTeam = getPlayer(gameState, declaringPlayerId)?.team;
  if (!declaringTeam) {
    throw new Error("Declaring player does not exist.");
  }

  const actualHolders = getActualHalfSuitHolders(gameState, declaration.halfSuit);
  const requiredCodes = getHalfSuitCards(declaration.halfSuit).map((card) => cardToCode(card));
  const isCorrect = requiredCodes.every(
    (code) => declaration.cardHolders[code] && declaration.cardHolders[code] === actualHolders[code],
  );

  const winningTeam = isCorrect ? declaringTeam : getOpponentTeam(declaringTeam);
  const nextHands = cloneHands(gameState.hands);

  // All six cards are removed regardless of declaration correctness.
  for (const cardCode of requiredCodes) {
    const holderId = actualHolders[cardCode];
    if (!holderId) {
      continue;
    }
    const card = codeToCard(cardCode);
    nextHands[holderId] = removeExactCard(nextHands[holderId] ?? [], card);
  }

  const nextBooks: Record<Team, HalfSuit[]> = {
    TEAM_A: [...gameState.books.TEAM_A],
    TEAM_B: [...gameState.books.TEAM_B],
  };
  nextBooks[winningTeam].push(declaration.halfSuit);

  const nextScores: Record<Team, number> = {
    TEAM_A: gameState.scores.TEAM_A,
    TEAM_B: gameState.scores.TEAM_B,
  };
  nextScores[winningTeam] += 1;

  const postDeclarePlayers = updateHandCounts(gameState.players, nextHands);
  const defaultTurnPlayerId = selectNextTurnFromTeam(
    {
      ...gameState,
      hands: nextHands,
      players: postDeclarePlayers,
    },
    winningTeam,
  );
  const resolvedTurnPlayerId =
    (nextHands[defaultTurnPlayerId] ?? []).length > 0
      ? defaultTurnPlayerId
      : (getNextTurnAfterEmpty(
          {
            players: postDeclarePlayers,
            hands: nextHands,
          },
          defaultTurnPlayerId,
        ) ?? defaultTurnPlayerId);

  const stateAfterDeclare: GameState = {
    ...gameState,
    hands: nextHands,
    players: postDeclarePlayers,
    books: nextBooks,
    scores: nextScores,
    currentTurnPlayerId: resolvedTurnPlayerId,
    lastDeclaredTeam: declaringTeam,
    lastMove: {
      id: `move-${Date.now()}`,
      gameId: gameState.id,
      playerId: declaringPlayerId,
      type: "DECLARE",
      declaredSet: declaration.halfSuit,
      success: isCorrect,
      timestamp: new Date().toISOString(),
    },
  };

  if (isGameOver(stateAfterDeclare, declaringTeam)) {
    return {
      ...stateAfterDeclare,
      status: "FINISHED",
    };
  }

  return stateAfterDeclare;
};

export const getValidMoves = (gameState: GameState, playerId: string): ValidMoves => {
  const player = getPlayer(gameState, playerId);
  if (!player) {
    return { canAsk: false, askableCards: [], declarableHalfSuits: [] };
  }

  const playerHand = gameState.hands[playerId] ?? [];
  const heldHalfSuits = new Set(playerHand.map((card) => card.halfSuit));

  const askableCards: Card[] = [];
  for (const opponent of gameState.players.filter((candidate) => candidate.team !== player.team)) {
    for (const opponentCard of gameState.hands[opponent.id] ?? []) {
      if (
        heldHalfSuits.has(opponentCard.halfSuit) &&
        !hasExactCard(playerHand, opponentCard) &&
        !askableCards.some((card) => cardToCode(card) === cardToCode(opponentCard))
      ) {
        askableCards.push(opponentCard);
      }
    }
  }

  const declarableHalfSuits = HALF_SUITS.filter((halfSuit) =>
    teamHasAnyCardFromHalfSuit(gameState, player.team, halfSuit),
  );

  return {
    canAsk: gameState.currentTurnPlayerId === playerId && !isGameOver(gameState),
    askableCards,
    declarableHalfSuits,
  };
};

export const isGameOver = (gameState: GameState, lastDeclaredTeam?: Team): boolean => {
  const claimedBooks = TEAM_IDS.reduce((count, team) => count + gameState.books[team].length, 0);
  if (claimedBooks >= 8) {
    return true;
  }

  const anyCardsLeft = gameState.players.some((player) => (gameState.hands[player.id] ?? []).length > 0);
  if (!anyCardsLeft) {
    return true;
  }

  if (lastDeclaredTeam) {
    const declaringTeamHasCards = gameState.players
      .filter((player) => player.team === lastDeclaredTeam)
      .some((player) => (gameState.hands[player.id] ?? []).length > 0);
    if (!declaringTeamHasCards) {
      return true;
    }
  }

  return false;
};

export const getWinner = (gameState: GameState): Team | "DRAW" | null => {
  if (!isGameOver(gameState)) {
    return null;
  }

  if (gameState.scores.TEAM_A > gameState.scores.TEAM_B) {
    return "TEAM_A";
  }
  if (gameState.scores.TEAM_B > gameState.scores.TEAM_A) {
    return "TEAM_B";
  }
  return "DRAW";
};
