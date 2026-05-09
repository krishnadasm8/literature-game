import React, { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { HalfSuit, MoveType, type Card, type Move, type Player, Team } from "@shared/src";

import { HandView } from "../../components/cards/HandView";
import { ActionLog } from "../../components/game/ActionLog";
import { ScoreBoard } from "../../components/game/ScoreBoard";
import { TurnIndicator } from "../../components/game/TurnIndicator";
import { PlayerSlot } from "../../components/room/PlayerSlot";
import { useGameState } from "../../hooks/useGameState";
import { playCard, respondToAsk } from "../../services/gameService";
import { socketService } from "../../services/socket";
import { useAuthStore } from "../../store/authStore";
import { useGameStore } from "../../store/gameStore";
import { getHalfSuit } from "../../utils/cardHelpers";

const RANKS_BY_TIER = {
  LOW: ["TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN"],
  HIGH: ["NINE", "TEN", "JACK", "QUEEN", "KING", "ACE"],
} as const;

interface IncomingAsk {
  gameId: string;
  askingPlayerId: string;
  askingPlayerName: string;
  targetPlayerId: string;
  targetPlayerName: string;
  card: Card;
  targetHasCard: boolean;
}

export default function GameCodeScreen(): JSX.Element {
  const { code } = useLocalSearchParams<{ code: string }>();
  const user = useAuthStore((state) => state.user);
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 390;
  const gameState = useGameStore((state) => state.gameState);
  const myHand = useGameStore((state) => state.myHand);
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);
  const [selectedAskCard, setSelectedAskCard] = useState<Card | null>(null);
  const [selectedHalfSuit, setSelectedHalfSuit] = useState<HalfSuit | null>(null);
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [incomingAsk, setIncomingAsk] = useState<IncomingAsk | null>(null);
  const [respondingAsk, setRespondingAsk] = useState(false);
  const [notificationText, setNotificationText] = useState<string | null>(null);
  const askSheetY = useSharedValue(0);

  useGameState(code);

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

  useEffect(() => {
    const offAskRequested = socketService.on<IncomingAsk>("game:ask_requested", (payload) => {
      if (payload.targetPlayerId === user?.id) {
        setIncomingAsk(payload);
      }
    });

    const offAskResolved = socketService.on<{ message?: string }>("game:ask_resolved", (payload) => {
      if (payload.message) {
        setNotificationText(payload.message);
        setTimeout(() => setNotificationText(null), 2500);
      }
      setIncomingAsk(null);
    });

    return () => {
      offAskRequested();
      offAskResolved();
    };
  }, [user?.id]);

  const askSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: askSheetY.value }],
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
    if (!selectedHalfSuit) {
      return [];
    }
    return myHand.filter((card) => card.halfSuit === selectedHalfSuit);
  }, [myHand, selectedHalfSuit]);

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

  const respondIncomingAsk = async (): Promise<void> => {
    if (!incomingAsk) {
      return;
    }
    setRespondingAsk(true);
    try {
      const responseChoice: "GIVE" | "NO" = incomingAsk.targetHasCard ? "GIVE" : "NO";
      const result = await respondToAsk(incomingAsk.gameId, responseChoice);
      if (result?.gameState) {
        useGameStore.getState().setGameState(result.gameState);
      }
      if (result?.myHand) {
        useGameStore.getState().setMyHand(result.myHand);
      }
      setIncomingAsk(null);
    } catch (error) {
      Alert.alert("Ask Response Error", error instanceof Error ? error.message : "Failed to respond.");
    } finally {
      setRespondingAsk(false);
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
      <ScrollView
        contentContainerStyle={[styles.contentContainer, isSmallScreen && styles.contentContainerSmall]}
        showsVerticalScrollIndicator={false}
      >
        <ScoreBoard teamAScore={teamAScore} teamBScore={teamBScore} round={gameState.round} />

        <View style={[styles.opponentArea, isSmallScreen && styles.opponentAreaSmall]}>
          {opponents.map((player) => (
            <View key={player.id} style={styles.opponentSlotWrap}>
              <PlayerSlot
                player={player as Player}
                selected={selectedOpponentId === player.id}
                pressable={isMyTurn && player.team !== myPlayer?.team && Boolean(selectedAskCard)}
                onPress={() => {
                  if (!isMyTurn || player.team === myPlayer?.team || !selectedAskCard) {
                    return;
                  }
                  setSelectedOpponentId(player.id);
                }}
              />
            </View>
          ))}
        </View>

        <View style={styles.centerArea}>
          <Text style={styles.centerTitle}>Latest Action</Text>
          <Text style={styles.centerAction}>{centerAction}</Text>
        </View>
        {notificationText ? <Text style={styles.notice}>{notificationText}</Text> : null}

        <TurnIndicator isMyTurn={isMyTurn} currentPlayerName={currentTurnName} />
        <ActionLog moves={moveHistory} />

        <View style={styles.controls}>
          <Pressable
            style={[
              styles.declareButton,
              (!isMyTurn || submitting || !selectedAskCard || !selectedOpponentId) && styles.disabledButton,
            ]}
            disabled={!isMyTurn || submitting || !selectedAskCard || !selectedOpponentId}
            onPress={() => {
              void submitAsk();
            }}
          >
            <Text style={styles.declareButtonText}>{submitting ? "Asking..." : "Ask"}</Text>
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
        <Text style={styles.sheetSubtitle}>
          1) Pick half-suit  2) Pick card  3) Pick opposite player
        </Text>
        <Text style={styles.sheetSubtitle}>Selected opponent: {selectedOpponentId ?? "none"}</Text>
        <View style={styles.halfSuitRow}>
          {askableHalfSuits.map((halfSuit) => (
            <Pressable
              key={halfSuit}
              style={[styles.halfSuitChip, selectedHalfSuit === halfSuit && styles.halfSuitChipActive]}
              onPress={() => {
                setSelectedHalfSuit(halfSuit);
                setSelectedAskCard(null);
                setSelectedOpponentId(null);
              }}
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
          <Pressable
            style={styles.sheetCancel}
            onPress={() => {
              setSelectedAskCard(null);
              setSelectedHalfSuit(null);
              setSelectedOpponentId(null);
            }}
          >
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </Pressable>
        </View>
        </Animated.View>

        {incomingAsk ? (
          <View style={styles.responsePanel}>
            <Text style={styles.sheetTitle}>Incoming Ask</Text>
            <Text style={styles.sheetSubtitle}>
              {incomingAsk.askingPlayerName} asks for {incomingAsk.card.rank} of {incomingAsk.card.suit}
            </Text>
            <Pressable
              style={[styles.responseButton, respondingAsk && styles.disabledButton]}
              disabled={respondingAsk}
              onPress={() => {
                void respondIncomingAsk();
              }}
            >
              <Text style={styles.responseButtonText}>
                {respondingAsk ? "Sending..." : incomingAsk.targetHasCard ? "Give" : "No"}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  contentContainer: {
    padding: 12,
    gap: 10,
    paddingBottom: 24,
  },
  contentContainerSmall: {
    paddingHorizontal: 10,
    gap: 8,
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
    justifyContent: "space-between",
  },
  opponentAreaSmall: {
    gap: 6,
  },
  opponentSlotWrap: {
    width: "48%",
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
  notice: {
    color: "#1d4ed8",
    fontWeight: "700",
    textAlign: "center",
  },
  controls: {
    alignItems: "center",
  },
  declareButton: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minWidth: 120,
    alignItems: "center",
  },
  declareButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.5,
  },
  askPanel: {
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
  responsePanel: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    gap: 10,
  },
  responseButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#0f766e",
    paddingVertical: 10,
  },
  responseButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
