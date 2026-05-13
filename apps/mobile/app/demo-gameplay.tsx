import React, { useMemo, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { HalfSuit, Rank, Suit, Team, type Card } from "@shared/src";

import { CardView } from "../components/cards/CardView";
import { getHalfSuit, getHalfSuitCards } from "../utils/cardHelpers";

const BG = "#0f172a";
const SURFACE = "#1e293b";
const BORDER = "#334155";
const TEXT = "#f1f5f9";
const MUTED = "#94a3b8";
const PRIMARY = "#f59e0b";
const TEAM_A = "#3b82f6";
const TEAM_B = "#ef4444";

const mk = (suit: Suit, rank: Rank): Card => ({
  suit,
  rank,
  halfSuit: getHalfSuit(suit, rank),
});

type SeatKey = "north" | "east" | "south" | "west";

interface DemoStep {
  key: string;
  label: string;
  caption: string;
  detail: string;
  centerCards: Card[];
  highlightSeat: SeatKey | null;
  failOverlay?: boolean;
  successGlow?: boolean;
  showScore?: boolean;
}

const STEPS: DemoStep[] = [
  {
    key: "ask",
    label: "Ask",
    caption: "South (Team A) asks East (Team B) for the King of Spades.",
    detail: "If East holds the King of Spades, they must pass it over and South may ask again. Otherwise the turn ends.",
    centerCards: [mk(Suit.SPADES, Rank.KING)],
    highlightSeat: "south",
  },
  {
    key: "declare",
    label: "Declare",
    caption: "North (Team B) declares the whole half-suit: High Hearts.",
    detail: "A declare claims all six cards of that half-suit for your team in one play sequence.",
    centerCards: getHalfSuitCards(HalfSuit.HIGH_HEARTS),
    highlightSeat: "north",
  },
  {
    key: "fail",
    label: "Fail",
    caption: "The declare was wrong — wrong card or illegal order.",
    detail: "The half-suit is forfeited: Team A scores it instead.",
    centerCards: getHalfSuitCards(HalfSuit.HIGH_HEARTS),
    highlightSeat: "north",
    failOverlay: true,
  },
  {
    key: "success",
    label: "Success",
    caption: "Team A completes a correct declare (or ask chain).",
    detail: "They secure the score for that half-suit. Those six cards count toward Team A.",
    centerCards: getHalfSuitCards(HalfSuit.LOW_CLUBS),
    highlightSeat: "south",
    successGlow: true,
  },
  {
    key: "end",
    label: "End game",
    caption: "All half-suits are decided — Team A wins the match.",
    detail: "Final score is shown. In a live game, you would return to the lobby or rematch.",
    centerCards: [],
    highlightSeat: null,
    showScore: true,
  },
];

const PLAYERS: Record<SeatKey, { label: string; team: Team; initials: string }> = {
  north: { label: "North", team: Team.TEAM_B, initials: "NB" },
  east: { label: "East", team: Team.TEAM_B, initials: "EB" },
  south: { label: "South", team: Team.TEAM_A, initials: "SA" },
  west: { label: "West", team: Team.TEAM_A, initials: "WA" },
};

function PlayerChip({
  seat,
  active,
}: {
  seat: SeatKey;
  active: boolean;
}): JSX.Element {
  const p = PLAYERS[seat];
  const color = p.team === Team.TEAM_A ? TEAM_A : TEAM_B;
  return (
    <View style={[styles.chip, { borderColor: color }, active && styles.chipActive]}>
      <View style={[styles.chipAvatar, { backgroundColor: color }]}>
        <Text style={styles.chipInitials}>{p.initials}</Text>
      </View>
      <Text style={styles.chipName}>{p.label}</Text>
      <Text style={styles.chipTeam}>{p.team === Team.TEAM_A ? "Team A" : "Team B"}</Text>
    </View>
  );
}

export default function DemoGameplayScreen(): JSX.Element {
  const [index, setIndex] = useState(0);
  const step = STEPS[index] ?? STEPS[0];
  const highlight = step.highlightSeat;

  const cardSize = useMemo(() => {
    const n = step.centerCards.length;
    if (n <= 1) return { w: 56, h: 82 };
    if (n <= 4) return { w: 44, h: 64 };
    return { w: 34, h: 50 };
  }, [step.centerCards.length]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Demo Gameplay",
          headerStyle: { backgroundColor: SURFACE },
          headerTintColor: PRIMARY,
          headerTitleStyle: { color: TEXT, fontWeight: "800" },
        }}
      />
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.hint}>Tap a step or use Next to see how four players interact in Literature.</Text>

          <View style={styles.stepRow}>
            {STEPS.map((s, i) => (
              <Pressable
                key={s.key}
                onPress={() => setIndex(i)}
                style={[styles.stepPill, i === index && styles.stepPillActive]}
              >
                <Text style={[styles.stepPillText, i === index && styles.stepPillTextActive]} numberOfLines={1}>
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.table}>
            <View style={styles.tableNorth}>
              <PlayerChip seat="north" active={highlight === "north"} />
            </View>

            <View style={styles.tableMid}>
              <PlayerChip seat="west" active={highlight === "west"} />
              <View style={styles.tableCenter}>
                {step.failOverlay ? (
                  <View style={styles.centerStack}>
                    <View style={styles.cardSpread}>
                      {step.centerCards.map((c) => (
                        <View key={`${c.suit}-${c.rank}`} style={styles.cardSlot}>
                          <CardView card={c} faceUp selected={false} playable={false} width={cardSize.w} height={cardSize.h} />
                        </View>
                      ))}
                    </View>
                    <View style={styles.failBanner}>
                      <Text style={styles.failBannerText}>Declare failed</Text>
                    </View>
                  </View>
                ) : step.successGlow ? (
                  <View style={[styles.centerStack, styles.successRing]}>
                    <View style={styles.cardSpread}>
                      {step.centerCards.map((c) => (
                        <View key={`${c.suit}-${c.rank}`} style={styles.cardSlot}>
                          <CardView card={c} faceUp selected={false} playable width={cardSize.w} height={cardSize.h} />
                        </View>
                      ))}
                    </View>
                  </View>
                ) : step.showScore ? (
                  <View style={styles.scoreCard}>
                    <Text style={styles.scoreTitle}>Final score</Text>
                    <View style={styles.scoreRow}>
                      <Text style={styles.scoreTeamA}>Team A — score 5</Text>
                    </View>
                    <View style={styles.scoreRow}>
                      <Text style={styles.scoreTeamB}>Team B — score 3</Text>
                    </View>
                    <Text style={styles.scoreWinner}>Team A wins</Text>
                  </View>
                ) : (
                  <View style={styles.cardSpread}>
                    {step.centerCards.map((c) => (
                      <View key={`${c.suit}-${c.rank}`} style={styles.cardSlot}>
                        <CardView card={c} faceUp selected={false} playable width={cardSize.w} height={cardSize.h} />
                      </View>
                    ))}
                  </View>
                )}
              </View>
              <PlayerChip seat="east" active={highlight === "east"} />
            </View>

            <View style={styles.tableSouth}>
              <PlayerChip seat="south" active={highlight === "south"} />
            </View>
          </View>

          <View style={styles.narration}>
            <Text style={styles.caption}>{step.caption}</Text>
            <Text style={styles.detail}>{step.detail}</Text>
          </View>

          <View style={styles.navRow}>
            <Pressable
              style={[styles.navBtn, index === 0 && styles.navBtnDisabled]}
              disabled={index === 0}
              onPress={() => setIndex((i) => Math.max(0, i - 1))}
            >
              <Text style={styles.navBtnText}>Previous</Text>
            </Pressable>
            <Pressable
              style={[styles.navBtn, styles.navBtnPrimary, index === STEPS.length - 1 && styles.navBtnDisabled]}
              disabled={index === STEPS.length - 1}
              onPress={() => setIndex((i) => Math.min(STEPS.length - 1, i + 1))}
            >
              <Text style={[styles.navBtnText, styles.navBtnTextPrimary]}>Next</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  scroll: { padding: 16, paddingBottom: 32, gap: 14 },
  hint: { color: MUTED, fontSize: 13, lineHeight: 19 },
  stepRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stepPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  stepPillActive: { borderColor: PRIMARY, backgroundColor: "rgba(245,158,11,0.12)" },
  stepPillText: { color: MUTED, fontSize: 12, fontWeight: "800" },
  stepPillTextActive: { color: PRIMARY },
  table: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    gap: 10,
  },
  tableNorth: { alignItems: "center" },
  tableMid: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 140 },
  tableSouth: { alignItems: "center" },
  tableCenter: {
    flex: 1,
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 8,
  },
  chip: {
    alignItems: "center",
    padding: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BORDER,
    backgroundColor: BG,
    minWidth: 88,
    gap: 4,
  },
  chipActive: {
    borderWidth: 2,
    shadowColor: PRIMARY,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  chipAvatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  chipInitials: { color: "#fff", fontWeight: "900", fontSize: 11 },
  chipName: { color: TEXT, fontSize: 11, fontWeight: "800" },
  chipTeam: { color: MUTED, fontSize: 10, fontWeight: "700" },
  cardSpread: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, alignItems: "center" },
  cardSlot: {},
  centerStack: { alignItems: "center", gap: 8, width: "100%" },
  failBanner: {
    backgroundColor: "rgba(239,68,68,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: TEAM_B,
  },
  failBannerText: { color: "#fecaca", fontWeight: "900", fontSize: 13 },
  successRing: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#22c55e",
    backgroundColor: "rgba(34,197,94,0.08)",
  },
  scoreCard: { alignItems: "center", gap: 8, paddingVertical: 8 },
  scoreTitle: { color: MUTED, fontSize: 12, fontWeight: "800" },
  scoreRow: { width: "100%", alignItems: "center" },
  scoreTeamA: { color: TEAM_A, fontWeight: "800", fontSize: 15 },
  scoreTeamB: { color: TEAM_B, fontWeight: "800", fontSize: 15 },
  scoreWinner: { color: PRIMARY, fontWeight: "900", fontSize: 16, marginTop: 4 },
  narration: { gap: 8 },
  caption: { color: TEXT, fontSize: 15, fontWeight: "800", lineHeight: 22 },
  detail: { color: MUTED, fontSize: 14, lineHeight: 20 },
  navRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  navBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: SURFACE,
  },
  navBtnPrimary: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { color: TEXT, fontWeight: "800", fontSize: 15 },
  navBtnTextPrimary: { color: "#111827" },
});
