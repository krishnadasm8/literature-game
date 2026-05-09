import { describe, expect, test } from "@jest/globals";

import { cardToCode, codeToCard, getHalfSuitCards, type Card, type HalfSuit } from "./deck";
import {
  applyAsk,
  applyDeclare,
  getWinner,
  isGameOver,
  isValidAsk,
  isValidDeclare,
  type Declaration,
  type GameState,
} from "./rules";

const playerIds = ["p0", "p1", "p2", "p3", "p4", "p5"];

const makePlayers = (hands: Record<string, Card[]>) => [
  { id: "p0", team: "TEAM_A" as const, handCount: hands.p0.length, isConnected: true },
  { id: "p1", team: "TEAM_B" as const, handCount: hands.p1.length, isConnected: true },
  { id: "p2", team: "TEAM_A" as const, handCount: hands.p2.length, isConnected: true },
  { id: "p3", team: "TEAM_B" as const, handCount: hands.p3.length, isConnected: true },
  { id: "p4", team: "TEAM_A" as const, handCount: hands.p4.length, isConnected: true },
  { id: "p5", team: "TEAM_B" as const, handCount: hands.p5.length, isConnected: true },
];

const makeBaseState = (): GameState => {
  const hands: Record<string, Card[]> = {
    p0: [codeToCard("9S"), codeToCard("KH"), codeToCard("2C")],
    p1: [codeToCard("AS"), codeToCard("3D")],
    p2: [codeToCard("10S"), codeToCard("2H")],
    p3: [codeToCard("4C")],
    p4: [codeToCard("JS"), codeToCard("5H")],
    p5: [codeToCard("6D")],
  };

  return {
    id: "g1",
    roomId: "r1",
    status: "PLAYING",
    currentTurnPlayerId: "p0",
    players: makePlayers(hands),
    hands,
    scores: { TEAM_A: 0, TEAM_B: 0 },
    books: { TEAM_A: [], TEAM_B: [] },
    round: 1,
  };
};

const makeDeclarationState = (): GameState => {
  const hands: Record<string, Card[]> = {
    p0: [codeToCard("2H"), codeToCard("3H"), codeToCard("AS")],
    p1: [codeToCard("9D")],
    p2: [codeToCard("4H"), codeToCard("5H"), codeToCard("KD")],
    p3: [codeToCard("QC")],
    p4: [codeToCard("6H"), codeToCard("7H"), codeToCard("JS")],
    p5: [codeToCard("10C")],
  };

  return {
    id: "g2",
    roomId: "r1",
    status: "PLAYING",
    currentTurnPlayerId: "p0",
    players: makePlayers(hands),
    hands,
    scores: { TEAM_A: 0, TEAM_B: 0 },
    books: { TEAM_A: [], TEAM_B: [] },
    round: 1,
  };
};

const buildLowHeartsDeclaration = (override: Partial<Record<string, string>> = {}): Declaration => {
  const cardHolders: Record<string, string> = {};
  const expected: Record<string, string> = {
    "2H": "p0",
    "3H": "p0",
    "4H": "p2",
    "5H": "p2",
    "6H": "p4",
    "7H": "p4",
  };

  for (const card of getHalfSuitCards("LOW_HEARTS")) {
    const code = cardToCode(card);
    cardHolders[code] = override[code] ?? expected[code];
  }

  return {
    halfSuit: "LOW_HEARTS",
    cardHolders,
  };
};

describe("literature rules engine", () => {
  test("valid ask scenario", () => {
    const state = makeBaseState();
    const result = isValidAsk(state, "p0", "p1", codeToCard("AS"));
    expect(result.valid).toBe(true);
  });

  test("invalid ask scenarios", () => {
    const state = makeBaseState();

    const teammateAsk = isValidAsk(state, "p0", "p2", codeToCard("AS"));
    expect(teammateAsk.valid).toBe(false);

    const wrongHalfSuitAsk = isValidAsk(state, "p0", "p1", codeToCard("2H"));
    expect(wrongHalfSuitAsk.valid).toBe(false);

    const alreadyOwnsCardAsk = isValidAsk(state, "p0", "p1", codeToCard("9S"));
    expect(alreadyOwnsCardAsk.valid).toBe(false);
  });

  test("card transfer on successful ask", () => {
    const state = makeBaseState();
    const next = applyAsk(state, "p0", "p1", codeToCard("AS"));

    expect(next.hands.p0.some((card) => cardToCode(card) === "AS")).toBe(true);
    expect(next.hands.p1.some((card) => cardToCode(card) === "AS")).toBe(false);
    expect(next.currentTurnPlayerId).toBe("p0");
    expect(next.lastMove?.success).toBe(true);
  });

  test("turn changes on failed ask", () => {
    const state = makeBaseState();
    const next = applyAsk(state, "p0", "p1", codeToCard("QS"));

    expect(next.currentTurnPlayerId).toBe("p1");
    expect(next.lastMove?.success).toBe(false);
  });

  test("correct declaration awards declaring team", () => {
    const state = makeDeclarationState();
    const declaration = buildLowHeartsDeclaration();
    const valid = isValidDeclare(state, "p0", declaration);
    expect(valid.valid).toBe(true);

    const next = applyDeclare(state, "p0", declaration);

    expect(next.scores.TEAM_A).toBe(1);
    expect(next.scores.TEAM_B).toBe(0);
    expect(next.books.TEAM_A).toContain("LOW_HEARTS");
    expect(next.books.TEAM_B).toHaveLength(0);
    expect(playerIds.flatMap((id) => next.hands[id]).some((card) => card.halfSuit === "LOW_HEARTS")).toBe(false);
  });

  test("wrong declaration awards opposing team", () => {
    const state = makeDeclarationState();
    const declaration = buildLowHeartsDeclaration({ "7H": "p0" });
    const next = applyDeclare(state, "p0", declaration);

    expect(next.scores.TEAM_A).toBe(0);
    expect(next.scores.TEAM_B).toBe(1);
    expect(next.books.TEAM_B).toContain("LOW_HEARTS");
  });

  test("game over detection and winner", () => {
    const state = makeBaseState();
    state.books = {
      TEAM_A: ["LOW_HEARTS", "HIGH_HEARTS", "LOW_DIAMONDS", "HIGH_DIAMONDS"],
      TEAM_B: ["LOW_CLUBS", "HIGH_CLUBS", "LOW_SPADES", "HIGH_SPADES"],
    } as Record<"TEAM_A" | "TEAM_B", HalfSuit[]>;
    state.scores = { TEAM_A: 4, TEAM_B: 4 };

    expect(isGameOver(state)).toBe(true);
    expect(getWinner(state)).toBe("DRAW");
  });
});
