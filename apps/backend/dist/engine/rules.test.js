"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const deck_1 = require("./deck");
const rules_1 = require("./rules");
const playerIds = ["p0", "p1", "p2", "p3", "p4", "p5"];
const makePlayers = (hands) => [
    { id: "p0", team: "TEAM_A", handCount: hands.p0.length, isConnected: true },
    { id: "p1", team: "TEAM_B", handCount: hands.p1.length, isConnected: true },
    { id: "p2", team: "TEAM_A", handCount: hands.p2.length, isConnected: true },
    { id: "p3", team: "TEAM_B", handCount: hands.p3.length, isConnected: true },
    { id: "p4", team: "TEAM_A", handCount: hands.p4.length, isConnected: true },
    { id: "p5", team: "TEAM_B", handCount: hands.p5.length, isConnected: true },
];
const makeBaseState = () => {
    const hands = {
        p0: [(0, deck_1.codeToCard)("9S"), (0, deck_1.codeToCard)("KH"), (0, deck_1.codeToCard)("2C")],
        p1: [(0, deck_1.codeToCard)("AS"), (0, deck_1.codeToCard)("3D")],
        p2: [(0, deck_1.codeToCard)("10S"), (0, deck_1.codeToCard)("2H")],
        p3: [(0, deck_1.codeToCard)("4C")],
        p4: [(0, deck_1.codeToCard)("JS"), (0, deck_1.codeToCard)("5H")],
        p5: [(0, deck_1.codeToCard)("6D")],
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
const makeDeclarationState = () => {
    const hands = {
        p0: [(0, deck_1.codeToCard)("2H"), (0, deck_1.codeToCard)("3H"), (0, deck_1.codeToCard)("AS")],
        p1: [(0, deck_1.codeToCard)("9D")],
        p2: [(0, deck_1.codeToCard)("4H"), (0, deck_1.codeToCard)("5H"), (0, deck_1.codeToCard)("KD")],
        p3: [(0, deck_1.codeToCard)("QC")],
        p4: [(0, deck_1.codeToCard)("6H"), (0, deck_1.codeToCard)("7H"), (0, deck_1.codeToCard)("JS")],
        p5: [(0, deck_1.codeToCard)("10C")],
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
const buildLowHeartsDeclaration = (override = {}) => {
    const cardHolders = {};
    const expected = {
        "2H": "p0",
        "3H": "p0",
        "4H": "p2",
        "5H": "p2",
        "6H": "p4",
        "7H": "p4",
    };
    for (const card of (0, deck_1.getHalfSuitCards)("LOW_HEARTS")) {
        const code = (0, deck_1.cardToCode)(card);
        cardHolders[code] = override[code] ?? expected[code];
    }
    return {
        halfSuit: "LOW_HEARTS",
        cardHolders,
    };
};
(0, globals_1.describe)("literature rules engine", () => {
    (0, globals_1.test)("valid ask scenario", () => {
        const state = makeBaseState();
        const result = (0, rules_1.isValidAsk)(state, "p0", "p1", (0, deck_1.codeToCard)("AS"));
        (0, globals_1.expect)(result.valid).toBe(true);
    });
    (0, globals_1.test)("invalid ask scenarios", () => {
        const state = makeBaseState();
        const teammateAsk = (0, rules_1.isValidAsk)(state, "p0", "p2", (0, deck_1.codeToCard)("AS"));
        (0, globals_1.expect)(teammateAsk.valid).toBe(false);
        const wrongHalfSuitAsk = (0, rules_1.isValidAsk)(state, "p0", "p1", (0, deck_1.codeToCard)("2H"));
        (0, globals_1.expect)(wrongHalfSuitAsk.valid).toBe(false);
        const alreadyOwnsCardAsk = (0, rules_1.isValidAsk)(state, "p0", "p1", (0, deck_1.codeToCard)("9S"));
        (0, globals_1.expect)(alreadyOwnsCardAsk.valid).toBe(false);
    });
    (0, globals_1.test)("card transfer on successful ask", () => {
        const state = makeBaseState();
        const next = (0, rules_1.applyAsk)(state, "p0", "p1", (0, deck_1.codeToCard)("AS"));
        (0, globals_1.expect)(next.hands.p0.some((card) => (0, deck_1.cardToCode)(card) === "AS")).toBe(true);
        (0, globals_1.expect)(next.hands.p1.some((card) => (0, deck_1.cardToCode)(card) === "AS")).toBe(false);
        (0, globals_1.expect)(next.currentTurnPlayerId).toBe("p0");
        (0, globals_1.expect)(next.lastMove?.success).toBe(true);
    });
    (0, globals_1.test)("turn changes on failed ask", () => {
        const state = makeBaseState();
        const next = (0, rules_1.applyAsk)(state, "p0", "p1", (0, deck_1.codeToCard)("QS"));
        (0, globals_1.expect)(next.currentTurnPlayerId).toBe("p1");
        (0, globals_1.expect)(next.lastMove?.success).toBe(false);
    });
    (0, globals_1.test)("correct declaration awards declaring team", () => {
        const state = makeDeclarationState();
        const declaration = buildLowHeartsDeclaration();
        const valid = (0, rules_1.isValidDeclare)(state, "p0", declaration);
        (0, globals_1.expect)(valid.valid).toBe(true);
        const next = (0, rules_1.applyDeclare)(state, "p0", declaration);
        (0, globals_1.expect)(next.scores.TEAM_A).toBe(1);
        (0, globals_1.expect)(next.scores.TEAM_B).toBe(0);
        (0, globals_1.expect)(next.books.TEAM_A).toContain("LOW_HEARTS");
        (0, globals_1.expect)(next.books.TEAM_B).toHaveLength(0);
        (0, globals_1.expect)(playerIds.flatMap((id) => next.hands[id]).some((card) => card.halfSuit === "LOW_HEARTS")).toBe(false);
    });
    (0, globals_1.test)("wrong declaration awards opposing team", () => {
        const state = makeDeclarationState();
        const declaration = buildLowHeartsDeclaration({ "7H": "p0" });
        const next = (0, rules_1.applyDeclare)(state, "p0", declaration);
        (0, globals_1.expect)(next.scores.TEAM_A).toBe(0);
        (0, globals_1.expect)(next.scores.TEAM_B).toBe(1);
        (0, globals_1.expect)(next.books.TEAM_B).toContain("LOW_HEARTS");
    });
    (0, globals_1.test)("game over detection and winner", () => {
        const state = makeBaseState();
        state.books = {
            TEAM_A: ["LOW_HEARTS", "HIGH_HEARTS", "LOW_DIAMONDS", "HIGH_DIAMONDS"],
            TEAM_B: ["LOW_CLUBS", "HIGH_CLUBS", "LOW_SPADES", "HIGH_SPADES"],
        };
        state.scores = { TEAM_A: 4, TEAM_B: 4 };
        (0, globals_1.expect)((0, rules_1.isGameOver)(state)).toBe(true);
        (0, globals_1.expect)((0, rules_1.getWinner)(state)).toBe("DRAW");
    });
});
