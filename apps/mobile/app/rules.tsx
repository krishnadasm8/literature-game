import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { HalfSuit, Rank, Suit, type Card } from "@shared/src";

import { CardView } from "../components/cards/CardView";
import { getHalfSuit, getHalfSuitCards, sortHand } from "../utils/cardHelpers";

const BG = "#0f172a";
const SURFACE = "#1e293b";
const BORDER = "#334155";
const TEXT = "#f1f5f9";
const MUTED = "#94a3b8";
const PRIMARY = "#f59e0b";

const mk = (suit: Suit, rank: Rank): Card => ({
  suit,
  rank,
  halfSuit: getHalfSuit(suit, rank),
});

const EXAMPLE_ASK: Card = mk(Suit.SPADES, Rank.KING);
const EXAMPLE_HAND: Card[] = sortHand([
  mk(Suit.HEARTS, Rank.ACE),
  mk(Suit.DIAMONDS, Rank.SEVEN),
  mk(Suit.CLUBS, Rank.JACK),
  mk(Suit.SPADES, Rank.KING),
]);

const HIGH_HEARTS_CARDS = getHalfSuitCards(HalfSuit.HIGH_HEARTS);

function RuleBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function GameRulesScreen(): JSX.Element {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Game Rules",
          headerStyle: { backgroundColor: SURFACE },
          headerTintColor: PRIMARY,
          headerTitleStyle: { color: TEXT, fontWeight: "800" },
        }}
      />
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.lead}>
            Literature is a team trick-taking game played with a shortened deck. These rules match how this app plays.
          </Text>

          <RuleBlock title="The deck">
            <Text style={styles.p}>
              The game uses a standard 52-card deck with all 8s removed (48 cards). Ranks 2 through 7 form the low half
              of each suit; 9 through Ace form the high half — each group of six is one half-suit (one scoring unit).
            </Text>
            <View style={styles.cardRow}>
              <CardView card={mk(Suit.SPADES, Rank.TWO)} faceUp selected={false} playable={false} width={40} height={58} />
              <CardView card={mk(Suit.SPADES, Rank.SEVEN)} faceUp selected={false} playable={false} width={40} height={58} />
              <Text style={styles.rowEllipsis}>…</Text>
              <CardView card={mk(Suit.SPADES, Rank.NINE)} faceUp selected={false} playable={false} width={40} height={58} />
              <CardView card={mk(Suit.SPADES, Rank.ACE)} faceUp selected={false} playable={false} width={40} height={58} />
            </View>
          </RuleBlock>

          <RuleBlock title="Players & teams">
            <Text style={styles.p}>
              Games are 4 or 6 players in two teams (Team A and Team B). Partners sit opposite each other. The app
              assigns seats and teams when you join a room.
            </Text>
          </RuleBlock>

          <RuleBlock title="Goal">
            <Text style={styles.p}>
              Win as many half-suits as possible to build your team&apos;s score. There are eight half-suits to claim:
              Low/High for each of the four suits (e.g. {HalfSuit.HIGH_HEARTS.replace(/_/g, " ").toLowerCase()}).
            </Text>
          </RuleBlock>

          <RuleBlock title="Ask">
            <Text style={styles.p}>
              On your turn you may ask a specific opponent for a specific card (rank and suit). If they hold that
              card, they must hand it to your team and you may ask again. If they do not have it, your turn ends and
              play passes.
            </Text>
            <Text style={styles.subLabel}>Example card you might ask for:</Text>
            <View style={styles.cardRow}>
              <CardView card={EXAMPLE_ASK} faceUp selected={false} playable width={48} height={70} />
            </View>
            <Text style={styles.subLabel}>Your hand might include that card among others:</Text>
            <View style={styles.cardRowWrap}>
              {EXAMPLE_HAND.map((c) => (
                <CardView
                  key={`${c.suit}-${c.rank}`}
                  card={c}
                  faceUp
                  selected={c.rank === EXAMPLE_ASK.rank && c.suit === EXAMPLE_ASK.suit}
                  playable={false}
                  width={44}
                  height={64}
                />
              ))}
            </View>
          </RuleBlock>

          <RuleBlock title="Declare">
            <Text style={styles.p}>
              Instead of asking, you may declare that your team will capture every card in a half-suit. You must
              follow the app&apos;s declare rules (correct cards, legal order). A successful declare wins that
              half-suit for your score at once.
            </Text>
            <Text style={styles.subLabel}>All six cards in High Hearts (example half-suit):</Text>
            <View style={styles.cardRowWrap}>
              {HIGH_HEARTS_CARDS.map((c) => (
                <CardView
                  key={`${c.suit}-${c.rank}`}
                  card={c}
                  faceUp
                  selected={false}
                  playable={false}
                  width={38}
                  height={56}
                />
              ))}
            </View>
          </RuleBlock>

          <RuleBlock title="Success vs fail">
            <Text style={styles.p}>
              A correct declare (or completing the right sequence of asks) adds that half-suit to your team&apos;s
              score. A failed declare — wrong card or illegal play — forfeits it; the other team scores it instead.
            </Text>
            <View style={styles.compareRow}>
              <View style={styles.miniCol}>
                <Text style={styles.miniLabel}>Score won</Text>
                <View style={[styles.cardRowWrap, styles.winTint]}>
                  <CardView card={mk(Suit.CLUBS, Rank.QUEEN)} faceUp selected={false} playable={false} width={42} height={62} />
                </View>
              </View>
              <View style={styles.miniCol}>
                <Text style={styles.miniLabel}>Score lost</Text>
                <View style={[styles.cardRowWrap, styles.failTint]}>
                  <CardView card={mk(Suit.DIAMONDS, Rank.KING)} faceUp selected={false} playable={false} width={42} height={62} />
                </View>
              </View>
            </View>
          </RuleBlock>

          <RuleBlock title="End of game">
            <Text style={styles.p}>
              When all half-suits are claimed or the match ends, the team with the higher score (and tie-break rules in
              the app) wins the game.
            </Text>
          </RuleBlock>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  scroll: { padding: 16, paddingBottom: 32, gap: 14 },
  lead: { color: MUTED, fontSize: 14, lineHeight: 20 },
  block: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    gap: 10,
  },
  blockTitle: { color: PRIMARY, fontSize: 17, fontWeight: "900" },
  p: { color: TEXT, fontSize: 14, lineHeight: 21 },
  subLabel: { color: MUTED, fontSize: 12, fontWeight: "700", marginTop: 4 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  cardRowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  rowEllipsis: { color: MUTED, fontWeight: "900", paddingHorizontal: 4 },
  compareRow: { flexDirection: "row", gap: 12 },
  miniCol: { flex: 1, gap: 6 },
  miniLabel: { color: MUTED, fontSize: 11, fontWeight: "800", textAlign: "center" },
  winTint: {
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: 10,
    padding: 8,
    justifyContent: "center",
  },
  failTint: {
    backgroundColor: "rgba(239,68,68,0.14)",
    borderRadius: 10,
    padding: 8,
    justifyContent: "center",
  },
});
