import React, { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { HalfSuit, MoveType, type Card, type Move, type Player, Team } from "@shared/src";

import { HandView } from "../../components/cards/HandView";
import { ActionLog } from "../../components/game/ActionLog";
import { ScoreBoard } from "../../components/game/ScoreBoard";
import { TurnIndicator } from "../../components/game/TurnIndicator";
import { PlayerSlot } from "../../components/room/PlayerSlot";
import { useGameState } from "../../hooks/useGameState";
import { playCard } from "../../services/gameService";
import { useAuthStore } from "../../store/authStore";
import { useGameStore } from "../../store/gameStore";
import { getHalfSuit } from "../../utils/cardHelpers";

const HALF_SUIT_OPTIONS: HalfSuit[] = [
  HalfSuit.LOW_HEARTS,
  HalfSuit.HIGH_HEARTS,
  HalfSuit.LOW_DIAMONDS,
  HalfSuit.HIGH_DIAMONDS,
  HalfSuit.LOW_CLUBS,
  HalfSuit.HIGH_CLUBS,
  HalfSuit.LOW_SPADES,
  HalfSuit.HIGH_SPADES,
];

const RANKS_BY_TIER = {
  LOW: ["TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN"],
  HIGH: ["NINE", "TEN", "JACK", "QUEEN", "KING", "ACE"],
} as const;

export default function GameCodeScreen(): JSX.Element {
  const { code } = useLocalSearchParams<{ code: string }>();
  const user = useAuthStore((state) => state.user);
  const gameState = useGameStore((state) => state.gameState);
  const myHand = useGameStore((state) => state.myHand);
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);
  const [selectedAskCard, setSelectedAskCard] = useState<Card | null>(null);
  const [selectedHalfSuit, setSelectedHalfSuit] = useState<HalfSuit | null>(null);
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [declareOpen, setDeclareOpen] = useState(false);

  const askSheetY = useSharedValue(300);
  const declareSheetY = useSharedValue(320);

  useGameState(code);

  useEffect(() => {
    askSheetY.value = withTiming(selectedOpponentId ? 0 : 300, { duration: 220 });
  }, [askSheetY, selectedOpponentId]);

  useEffect(() => {
    declareSheetY.value = withTiming(declareOpen ? 0 : 320, { duration: 220 });
  }, [declareOpen, declareSheetY]);

  useEffect(() => {
    if (gameState?.lastMove) {
      setMoveHistory((current) => {
        if (current[0]?.id === gameState.lastMove?.id) {
          return current;
        }
        return [...current, gameState.lastMove as Move];
      });
    }
  }, [gameState?.lastMove]);

  const askSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: askSheetY.value }],
  }));
  const declareSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: declareSheetY.value }],
  }));

  const players = gameState?.players ?? [];
  const myPlayer = players.find((player) => player.id === user?.id) ?? null;
  const isMyTurn = Boolean(user?.id && gameState?.currentTurnPlayerId === user.id);
  const teamAScore = gameState?.scores?.[Team.TEAM_A] ?? 0;
  const teamBScore = gameState?.scores?.[Team.TEAM_B] ?? 0;
  const currentTurnName =
    players.find((player) => player.id === gameState?.currentTurnPlayerId)?.displayName ?? "Unknown";

  const opponents = useMemo(() => {
    if (!myPlayer) {
      return players;
    }
    return players.filter((player) => player.id !== myPlayer.id);
  }, [myPlayer, players]);

  const playableCards = useMemo(() => {
    if (!selectedOpponentId) {
      return [];
    }
    const halfSuits = new Set(myHand.map((card) => card.halfSuit));
    return myHand.filter((card) => halfSuits.has(card.halfSuit));
  }, [myHand, selectedOpponentId]);

  const askableHalfSuits = useMemo(() => {
    return Array.from(new Set(myHand.map((card) => card.halfSuit)));
  }, [myHand]);

  const askCardsForHalfSuit = useMemo(() => {
    if (!selectedHalfSuit) {
      return [];
    }
    const [, suitToken] = selectedHalfSuit.split("_");
    const isLow = selectedHalfSuit.startsWith("LOW");
    const suit = suitToken as Card["suit"];
    const ranks = isLow ? RANKS_BY_TIER.LOW : RANKS_BY_TIER.HIGH;
    return ranks
      .map((rank) => {
        const card = {
          suit,
          rank: rank as Card["rank"],
          halfSuit: getHalfSuit(suit, rank as Card["rank"]),
        };
        return card;
      })
      .filter((card) => !myHand.some((owned) => owned.rank === card.rank && owned.suit === card.suit));
  }, [myHand, selectedHalfSuit]);

  const centerAction = useMemo(() => {
    const lastMove = moveHistory[moveHistory.length - 1];
    if (!lastMove) {
      return "No actions yet.";
    }
    if (lastMove.type === MoveType.ASK && lastMove.card) {
      return `${lastMove.playerId} asked ${lastMove.targetPlayerId ?? "?"} for ${lastMove.card.rank} of ${lastMove.card.suit}`;
    }
    return `${lastMove.playerId} declared ${lastMove.declaredSet ?? "a set"}`;
  }, [moveHistory]);

  const submitAsk = async (): Promise<void> => {
    if (!gameState || !selectedOpponentId || !selectedAskCard) {
      return;
    }

    setSubmitting(true);
    try {
      await playCard(gameState.id, {
        targetPlayerId: selectedOpponentId,
        card: selectedAskCard,
      });
      setSelectedAskCard(null);
      setSelectedOpponentId(null);
      setSelectedHalfSuit(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (!gameState) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading game {code}...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScoreBoard teamAScore={teamAScore} teamBScore={teamBScore} round={gameState.round} />

      <View style={styles.opponentArea}>
        {opponents.map((player) => (
          <PlayerSlot
            key={player.id}
            player={player as Player}
            selected={selectedOpponentId === player.id}
            pressable={isMyTurn && player.team !== myPlayer?.team}
            onPress={() => {
              if (!isMyTurn || player.team === myPlayer?.team) {
                return;
              }
              setSelectedOpponentId(player.id);
            }}
          />
        ))}
      </View>

      <View style={styles.centerArea}>
        <Text style={styles.centerTitle}>Latest Action</Text>
        <Text style={styles.centerAction}>{centerAction}</Text>
      </View>

      <TurnIndicator isMyTurn={isMyTurn} currentPlayerName={currentTurnName} />
      <ActionLog moves={moveHistory} />

      <View style={styles.controls}>
        <Pressable
          style={[styles.declareButton, (!isMyTurn || submitting) && styles.disabledButton]}
          disabled={!isMyTurn || submitting}
          onPress={() => setDeclareOpen(true)}
        >
          <Text style={styles.declareButtonText}>Declare</Text>
        </Pressable>
      </View>

      <HandView
        hand={myHand}
        playableCards={playableCards}
        onCardSelect={(card) => {
          if (selectedOpponentId) {
            setSelectedAskCard(card);
            setSelectedHalfSuit(card.halfSuit);
          }
        }}
      />

      <Animated.View style={[styles.askPanel, askSheetStyle]}>
        <Text style={styles.sheetTitle}>Ask Opponent</Text>
        <Text style={styles.sheetSubtitle}>Selected opponent: {selectedOpponentId ?? "none"}</Text>
        <View style={styles.halfSuitRow}>
          {askableHalfSuits.map((halfSuit) => (
            <Pressable
              key={halfSuit}
              style={[styles.halfSuitChip, selectedHalfSuit === halfSuit && styles.halfSuitChipActive]}
              onPress={() => setSelectedHalfSuit(halfSuit)}
            >
              <Text style={styles.halfSuitText}>{halfSuit.replace("_", " ")}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.askCardRow}>
          {askCardsForHalfSuit.map((card) => (
            <Pressable
              key={`${card.rank}-${card.suit}`}
              style={[
                styles.askCardChip,
                selectedAskCard?.rank === card.rank && selectedAskCard?.suit === card.suit
                  ? styles.askCardChipActive
                  : null,
              ]}
              onPress={() => setSelectedAskCard(card)}
            >
              <Text style={styles.askCardText}>{card.rank} {card.suit[0]}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.sheetActions}>
          <Pressable style={styles.sheetCancel} onPress={() => setSelectedOpponentId(null)}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            disabled={!selectedOpponentId || !selectedAskCard || submitting}
            style={[
              styles.sheetSubmit,
              (!selectedOpponentId || !selectedAskCard || submitting) && styles.disabledButton,
            ]}
            onPress={() => {
              void submitAsk();
            }}
          >
            <Text style={styles.sheetSubmitText}>{submitting ? "Submitting..." : "Ask"}</Text>
          </Pressable>
        </View>
      </Animated.View>

      <Animated.View style={[styles.declareSheet, declareSheetStyle]}>
        <Text style={styles.sheetTitle}>Declaration Sheet</Text>
        <Text style={styles.sheetSubtitle}>
          Choose a half-suit to declare.
        </Text>
        <View style={styles.halfSuitRow}>
          {HALF_SUIT_OPTIONS.map((halfSuit) => (
            <Pressable key={halfSuit} style={styles.halfSuitChip} onPress={() => setSelectedHalfSuit(halfSuit)}>
              <Text style={styles.halfSuitText}>{halfSuit.replace("_", " ")}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.sheetActions}>
          <Pressable style={styles.sheetCancel} onPress={() => setDeclareOpen(false)}>
            <Text style={styles.sheetCancelText}>Close</Text>
          </Pressable>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
    gap: 10,
    backgroundColor: "#f3f4f6",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: "#374151",
  },
  opponentArea: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  centerArea: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#065f46",
  },
  centerTitle: {
    color: "#d1fae5",
    fontWeight: "700",
    marginBottom: 6,
  },
  centerAction: {
    color: "#ffffff",
    fontSize: 14,
  },
  controls: {
    alignItems: "center",
  },
  declareButton: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  declareButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.5,
  },
  askPanel: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 110,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  declareSheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 110,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  sheetTitle: {
    fontWeight: "800",
    fontSize: 16,
    color: "#111827",
  },
  sheetSubtitle: {
    color: "#4b5563",
  },
  halfSuitRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  halfSuitChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f8fafc",
  },
  halfSuitChipActive: {
    borderColor: "#2563eb",
    backgroundColor: "#dbeafe",
  },
  halfSuitText: {
    color: "#1f2937",
    fontSize: 12,
    fontWeight: "600",
  },
  askCardRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  askCardChip: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  askCardChipActive: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  askCardText: {
    fontWeight: "700",
    fontSize: 12,
    color: "#1f2937",
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  sheetCancel: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sheetCancelText: {
    color: "#6b7280",
    fontWeight: "600",
  },
  sheetSubmit: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sheetSubmitText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
