import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { HalfSuit, MoveType, type Card, type Move, type Player, Team } from "@shared/src";

import { CardView } from "../../components/cards/CardView";
import { ActionLog } from "../../components/game/ActionLog";
import { ScoreBoard } from "../../components/game/ScoreBoard";
import { TurnIndicator } from "../../components/game/TurnIndicator";
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

interface PendingOutgoingAsk {
  targetPlayerId: string;
  targetPlayerName: string;
}

const getInitials = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

export default function GameCodeScreen(): JSX.Element {
  const { code } = useLocalSearchParams<{ code: string }>();
  const user = useAuthStore((state) => state.user);
  const gameState = useGameStore((state) => state.gameState);
  const myHand = useGameStore((state) => state.myHand);
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);
  const [selectedAskCard, setSelectedAskCard] = useState<Card | null>(null);
  const [selectedHalfSuit, setSelectedHalfSuit] = useState<HalfSuit | null>(null);
  const [selectedSourceCardCode, setSelectedSourceCardCode] = useState<string | null>(null);
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [incomingAsk, setIncomingAsk] = useState<IncomingAsk | null>(null);
  const [pendingOutgoingAsk, setPendingOutgoingAsk] = useState<PendingOutgoingAsk | null>(null);
  const [respondingAsk, setRespondingAsk] = useState(false);
  const [notificationText, setNotificationText] = useState<string | null>(null);
  const moveExpiryTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionSlideY = useSharedValue(20);
  const actionOpacity = useSharedValue(0);

  useGameState(code);

  useEffect(() => {
    if (gameState?.lastMove) {
      const incomingMove = gameState.lastMove as Move;
      setMoveHistory((current) => {
        if (current.some((move) => move.id === incomingMove.id)) {
          return current;
        }
        return [...current, incomingMove];
      });
      if (moveExpiryTimersRef.current[incomingMove.id]) {
        clearTimeout(moveExpiryTimersRef.current[incomingMove.id]);
      }
      moveExpiryTimersRef.current[incomingMove.id] = setTimeout(() => {
        setMoveHistory((current) => current.filter((move) => move.id !== incomingMove.id));
        delete moveExpiryTimersRef.current[incomingMove.id];
      }, 5000);
      actionSlideY.value = 16;
      actionOpacity.value = 0;
      actionSlideY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
      actionOpacity.value = withTiming(1, { duration: 280 });
    }
  }, [actionOpacity, actionSlideY, gameState?.lastMove]);

  useEffect(() => {
    return () => {
      Object.values(moveExpiryTimersRef.current).forEach((timerId) => clearTimeout(timerId));
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
    };
  }, []);

  const showNotificationForFiveSeconds = (message: string): void => {
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }
    setNotificationText(message);
    notificationTimerRef.current = setTimeout(() => {
      setNotificationText(null);
      notificationTimerRef.current = null;
    }, 5000);
  };

  useEffect(() => {
    const offAskRequested = socketService.on<IncomingAsk>("game:ask_requested", (payload) => {
      showNotificationForFiveSeconds(
        `${payload.askingPlayerName} asked ${payload.targetPlayerName} for ${payload.card.rank} of ${payload.card.suit}`,
      );
      if (payload.targetPlayerId === user?.id) {
        setIncomingAsk(payload);
      }
      if (payload.askingPlayerId === user?.id) {
        setPendingOutgoingAsk({
          targetPlayerId: payload.targetPlayerId,
          targetPlayerName: payload.targetPlayerName,
        });
      }
    });

    const offAskResolved = socketService.on<{ message?: string }>("game:ask_resolved", (payload) => {
      if (payload.message) {
        showNotificationForFiveSeconds(payload.message);
      }
      setIncomingAsk(null);
      setPendingOutgoingAsk(null);
    });

    return () => {
      offAskRequested();
      offAskResolved();
    };
  }, [user?.id]);

  const centerActionStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: actionSlideY.value }],
    opacity: Math.max(0.15, actionOpacity.value),
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
  const askableOpponents = useMemo(() => {
    if (!myPlayer) {
      return opponents;
    }
    return opponents.filter((player) => player.team !== myPlayer.team);
  }, [myPlayer, opponents]);
  const selectedOpponentName =
    askableOpponents.find((player) => player.id === selectedOpponentId)?.displayName ?? "none";
  const isWaitingForAskResponse = pendingOutgoingAsk !== null;

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
  const askPanelSourceCards = useMemo(() => {
    return myHand;
  }, [myHand]);

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

    const chosenOpponent =
      askableOpponents.find((player) => player.id === selectedOpponentId)?.displayName ?? "opponent";
    setSubmitting(true);
    setPendingOutgoingAsk({
      targetPlayerId: selectedOpponentId,
      targetPlayerName: chosenOpponent,
    });
    try {
      await playCard(gameState.id, {
        targetPlayerId: selectedOpponentId,
        card: selectedAskCard,
      });
      setSelectedAskCard(null);
      setSelectedOpponentId(null);
      setSelectedHalfSuit(null);
      setSelectedSourceCardCode(null);
      showNotificationForFiveSeconds(`Ask sent to ${chosenOpponent}`);
    } catch (error) {
      setPendingOutgoingAsk(null);
      Alert.alert("Ask Error", error instanceof Error ? error.message : "Failed to send ask.");
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
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <ScoreBoard teamAScore={teamAScore} teamBScore={teamBScore} round={gameState.round} />

        <View style={styles.playerCompactArea}>
          {opponents.map((player) => (
            <Pressable
              key={player.id}
              style={[
                styles.playerCompactCard,
                player.team === Team.TEAM_A ? styles.playerCompactCardA : styles.playerCompactCardB,
                gameState.currentTurnPlayerId === player.id && styles.playerCompactTurn,
                selectedOpponentId === player.id && styles.playerCompactSelected,
              ]}
              disabled={!isMyTurn || player.team === myPlayer?.team || !selectedAskCard}
              onPress={() => setSelectedOpponentId(player.id)}
            >
              <View style={styles.playerCompactAvatar}>
                <Text style={styles.playerCompactAvatarText}>{getInitials(player.displayName)}</Text>
              </View>
              <View style={styles.playerCompactMeta}>
                <Text style={styles.playerCompactName} numberOfLines={1}>
                  {player.displayName}
                </Text>
                <Text style={styles.playerCompactCount}>{player.handCount} cards</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {moveHistory.length > 0 ? (
          <Animated.View style={[styles.centerArea, centerActionStyle]}>
            <Text style={styles.centerTitle}>Latest Action</Text>
            <Text style={styles.centerAction}>{centerAction}</Text>
          </Animated.View>
        ) : null}
        {notificationText ? <Text style={styles.notice}>{notificationText}</Text> : null}

        {isWaitingForAskResponse ? (
          <View style={styles.waitingBanner}>
            <Text style={styles.waitingBannerText}>
              Waiting for response from {pendingOutgoingAsk?.targetPlayerName ?? "opponent"}...
            </Text>
          </View>
        ) : (
          <TurnIndicator isMyTurn={isMyTurn} currentPlayerName={currentTurnName} />
        )}
        {moveHistory.length > 0 ? <ActionLog moves={moveHistory} /> : null}
        <View style={styles.askPanel}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Ask Panel</Text>
            {!isMyTurn ? <Text style={styles.sheetTurnHint}>Wait your turn</Text> : null}
          </View>
          <Text style={styles.sheetSubtitle}>Pick one of your cards, then choose a card from that set.</Text>
          <Text style={styles.sheetSubtitle}>Selected opponent: {selectedOpponentName}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sourceSetRow}>
            {askPanelSourceCards.map((card, index) => {
              const sourceCode = `${card.rank}-${card.suit}-${index}`;
              const selectedSource = selectedSourceCardCode === sourceCode;
              return (
                <View
                  key={sourceCode}
                  style={[
                    styles.sourceCardChip,
                    index > 0 && styles.sourceCardChipStacked,
                  ]}
                >
                  <CardView
                    card={card}
                    faceUp
                    selected={selectedSource}
                    playable={selectedSource}
                    onPress={() => {
                      if (!isMyTurn) {
                        return;
                      }
                      setSelectedHalfSuit(card.halfSuit);
                      setSelectedSourceCardCode(sourceCode);
                      setSelectedAskCard(null);
                      setSelectedOpponentId(null);
                    }}
                  />
                </View>
              );
            })}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.askCardRow}>
            {askCardsForHalfSuit.map((card) => (
              <View
                key={`${card.rank}-${card.suit}`}
              style={styles.askCardChip}
              >
                <CardView
                  card={card}
                  faceUp
                  selected={selectedAskCard?.rank === card.rank && selectedAskCard?.suit === card.suit}
                  playable={selectedAskCard?.rank === card.rank && selectedAskCard?.suit === card.suit}
                  onPress={() => {
                    if (!isMyTurn) {
                      return;
                    }
                    setSelectedAskCard(card);
                  }}
                />
              </View>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.opponentRow}>
            {askableOpponents.map((player) => (
              <Pressable
                key={player.id}
                style={[
                  styles.opponentChip,
                  selectedOpponentId === player.id ? styles.opponentChipActive : null,
                  (!selectedAskCard || !isMyTurn) ? styles.disabledButton : null,
                ]}
                disabled={!selectedAskCard || !isMyTurn}
                onPress={() => setSelectedOpponentId(player.id)}
              >
                <Text style={styles.opponentChipText} numberOfLines={1}>
                  {player.displayName}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.sheetActions}>
            {isMyTurn ? (
              <Pressable
                style={[
                  styles.sheetAskButton,
                  (submitting || !selectedAskCard || !selectedOpponentId) && styles.disabledButton,
                ]}
                disabled={submitting || !selectedAskCard || !selectedOpponentId}
                onPress={() => {
                  void submitAsk();
                }}
              >
                <Text style={styles.sheetAskButtonText}>{submitting ? "Asking..." : "Ask"}</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.sheetCancel}
              onPress={() => {
                setSelectedAskCard(null);
                setSelectedHalfSuit(null);
                setSelectedSourceCardCode(null);
                setSelectedOpponentId(null);
              }}
            >
              <Text style={styles.sheetCancelText}>Reset</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#082032",
  },
  contentContainer: {
    paddingHorizontal: 10,
    paddingTop: 8,
    gap: 8,
    paddingBottom: 18,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: "#d1fae5",
  },
  playerCompactArea: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "space-between",
  },
  playerCompactCard: {
    width: "49%",
    minHeight: 56,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    gap: 8,
  },
  playerCompactCardA: {
    backgroundColor: "rgba(37,99,235,0.2)",
    borderColor: "rgba(59,130,246,0.45)",
  },
  playerCompactCardB: {
    backgroundColor: "rgba(239,68,68,0.16)",
    borderColor: "rgba(239,68,68,0.45)",
  },
  playerCompactTurn: {
    borderColor: "#f59e0b",
  },
  playerCompactSelected: {
    borderColor: "#22c55e",
    backgroundColor: "rgba(34,197,94,0.18)",
  },
  playerCompactAvatar: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  playerCompactAvatarText: {
    width: 30,
    textAlign: "center",
    color: "#f8fafc",
    fontSize: 11,
    fontWeight: "800",
  },
  playerCompactMeta: {
    flex: 1,
    minWidth: 0,
  },
  playerCompactName: {
    color: "#f8fafc",
    fontWeight: "700",
    fontSize: 12,
  },
  playerCompactCount: {
    color: "#cbd5e1",
    fontSize: 10,
  },
  centerArea: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(2,6,23,0.55)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.28)",
  },
  centerTitle: {
    color: "#f8fafc",
    fontWeight: "700",
    marginBottom: 6,
  },
  centerAction: {
    color: "#e2e8f0",
    fontSize: 14,
  },
  notice: {
    color: "#f59e0b",
    fontWeight: "700",
    textAlign: "center",
  },
  waitingBanner: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.5)",
    backgroundColor: "rgba(245,158,11,0.14)",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  waitingBannerText: {
    color: "#fde68a",
    textAlign: "center",
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.45,
  },
  askPanel: {
    backgroundColor: "rgba(15,23,42,0.96)",
    borderRadius: 14,
    padding: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.42)",
  },
  sheetTitle: {
    fontWeight: "800",
    fontSize: 16,
    color: "#f8fafc",
  },
  sheetSubtitle: {
    color: "#cbd5e1",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTurnHint: {
    color: "#fbbf24",
    fontWeight: "700",
    fontSize: 12,
  },
  sourceSetRow: {
    flexDirection: "row",
    gap: 0,
    paddingRight: 4,
    paddingLeft: 2,
  },
  sourceCardChip: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: "transparent",
  },
  sourceCardChipStacked: {
    marginLeft: -20,
  },
  askCardRow: {
    flexDirection: "row",
    gap: 6,
    paddingRight: 4,
    alignItems: "center",
    minHeight: 88,
    paddingVertical: 4,
  },
  askCardChip: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: "transparent",
  },
  opponentRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 4,
  },
  opponentChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    minWidth: 110,
    alignItems: "center",
  },
  opponentChipActive: {
    borderColor: "#22c55e",
    backgroundColor: "#14532d",
  },
  opponentChipText: {
    color: "#e2e8f0",
    fontWeight: "700",
    fontSize: 12,
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  sheetAskButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetAskButtonText: {
    color: "#052e16",
    fontWeight: "800",
  },
  sheetCancel: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sheetCancelText: {
    color: "#e2e8f0",
    fontWeight: "600",
  },
  responsePanel: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    backgroundColor: "rgba(2,6,23,0.95)",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#22c55e",
    gap: 8,
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
