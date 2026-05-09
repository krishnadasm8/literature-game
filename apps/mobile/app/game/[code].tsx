import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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

import { HalfSuit, MoveType, type Card, type Move, Team } from "@shared/src";

import { CardView } from "../../components/cards/CardView";
import { ActionLog } from "../../components/game/ActionLog";
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

function StepChip({ text, done, active }: { text: string; done: boolean; active: boolean }): JSX.Element {
  return (
    <View style={[styles.stepChip, done && styles.stepChipDone, active && styles.stepChipActive]}>
      <Text style={[styles.stepChipText, done && styles.stepChipTextDone]}>{done ? "✓" : text}</Text>
    </View>
  );
}

export default function GameCodeScreen(): JSX.Element {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const user = useAuthStore((state) => state.user);
  const gameState = useGameStore((state) => state.gameState);
  const myHand = useGameStore((state) => state.myHand);

  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);
  const [selectedHalfSuit, setSelectedHalfSuit] = useState<HalfSuit | null>(null);
  const [selectedSourceCardCode, setSelectedSourceCardCode] = useState<string | null>(null);
  const [selectedAskCard, setSelectedAskCard] = useState<Card | null>(null);
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  const [notificationText, setNotificationText] = useState<string | null>(null);
  const [incomingAsk, setIncomingAsk] = useState<IncomingAsk | null>(null);
  const [pendingOutgoingAsk, setPendingOutgoingAsk] = useState<PendingOutgoingAsk | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [respondingAsk, setRespondingAsk] = useState(false);
  const [askPanelOpen, setAskPanelOpen] = useState(false);

  const moveExpiryTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionSlideY = useSharedValue(12);
  const actionOpacity = useSharedValue(0);

  useGameState(code);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const showNotification = (message: string): void => {
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
    if (!gameState?.lastMove) {
      return;
    }
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

    actionSlideY.value = 12;
    actionOpacity.value = 0;
    actionSlideY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
    actionOpacity.value = withTiming(1, { duration: 220 });
  }, [actionOpacity, actionSlideY, gameState?.lastMove]);

  useEffect(() => {
    const offAskRequested = socketService.on<IncomingAsk>("game:ask_requested", (payload) => {
      showNotification(`${payload.askingPlayerName} asked ${payload.targetPlayerName} for ${payload.card.rank}`);
      if (payload.targetPlayerId === user?.id) {
        setIncomingAsk(payload);
      }
      if (payload.askingPlayerId === user?.id) {
        setPendingOutgoingAsk({ targetPlayerId: payload.targetPlayerId, targetPlayerName: payload.targetPlayerName });
      }
    });
    const offAskResolved = socketService.on<{ message?: string }>("game:ask_resolved", (payload) => {
      if (payload.message) {
        showNotification(payload.message);
      }
      setPendingOutgoingAsk(null);
      setIncomingAsk(null);
      setAskPanelOpen(false);
    });
    return () => {
      offAskRequested();
      offAskResolved();
    };
  }, [user?.id]);

  useEffect(() => {
    return () => {
      Object.values(moveExpiryTimersRef.current).forEach((timer) => clearTimeout(timer));
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
    };
  }, []);

  const players = gameState?.players ?? [];
  const myPlayer = players.find((player) => player.id === user?.id) ?? null;
  const isMyTurn = Boolean(user?.id && gameState?.currentTurnPlayerId === user.id);
  const teamAScore = gameState?.scores?.[Team.TEAM_A] ?? 0;
  const teamBScore = gameState?.scores?.[Team.TEAM_B] ?? 0;
  const currentTurnName =
    players.find((player) => player.id === gameState?.currentTurnPlayerId)?.displayName ?? "Unknown";

  const askableOpponents = useMemo(() => {
    if (!myPlayer) {
      return players;
    }
    return players.filter((player) => player.id !== myPlayer.id && player.team !== myPlayer.team);
  }, [myPlayer, players]);

  const selectedOpponentName =
    askableOpponents.find((player) => player.id === selectedOpponentId)?.displayName ?? "none";

  const askCardsForHalfSuit = useMemo(() => {
    if (!selectedHalfSuit) {
      return [];
    }
    const [, suitToken] = selectedHalfSuit.split("_");
    const isLow = selectedHalfSuit.startsWith("LOW");
    const suit = suitToken as Card["suit"];
    const ranks = isLow ? RANKS_BY_TIER.LOW : RANKS_BY_TIER.HIGH;
    return ranks
      .map((rank) => ({
        suit,
        rank: rank as Card["rank"],
        halfSuit: getHalfSuit(suit, rank as Card["rank"]),
      }))
      .filter((card) => !myHand.some((owned) => owned.rank === card.rank && owned.suit === card.suit));
  }, [myHand, selectedHalfSuit]);

  const centerAction = useMemo(() => {
    const latest = moveHistory[moveHistory.length - 1];
    if (!latest) {
      return "";
    }
    if (latest.type === MoveType.ASK && latest.card) {
      return `${latest.playerId} asked ${latest.targetPlayerId ?? "?"} for ${latest.card.rank}`;
    }
    return `${latest.playerId} declared ${latest.declaredSet ?? "a set"}`;
  }, [moveHistory]);

  const canSubmitAsk = Boolean(
    isMyTurn && selectedOpponentId && selectedHalfSuit && selectedAskCard && !submitting,
  );

  const submitAsk = async (): Promise<void> => {
    if (!gameState || !selectedOpponentId || !selectedAskCard) {
      return;
    }
    const targetName = askableOpponents.find((player) => player.id === selectedOpponentId)?.displayName ?? "opponent";
    setSubmitting(true);
    setPendingOutgoingAsk({ targetPlayerId: selectedOpponentId, targetPlayerName: targetName });
    try {
      await playCard(gameState.id, {
        targetPlayerId: selectedOpponentId,
        card: selectedAskCard,
      });
      showNotification(`Ask sent to ${targetName}`);
      setAskPanelOpen(false);
      setSelectedOpponentId(null);
      setSelectedHalfSuit(null);
      setSelectedSourceCardCode(null);
      setSelectedAskCard(null);
    } catch (error) {
      setPendingOutgoingAsk(null);
      Alert.alert("Ask Error", error instanceof Error ? error.message : "Failed to ask.");
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
      Alert.alert("Response Error", error instanceof Error ? error.message : "Failed to respond.");
    } finally {
      setRespondingAsk(false);
    }
  };

  const animatedActionStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: actionSlideY.value }],
    opacity: actionOpacity.value,
  }));

  if (!gameState) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Loading game {code}...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Pressable style={styles.headerSideButton} onPress={() => router.back()}>
          <Text style={styles.headerSideText}>← Back</Text>
        </Pressable>
        <View style={styles.headerRoomPill}>
          <Text style={styles.headerRoomText}>Room: {(code ?? "---").toUpperCase()}</Text>
        </View>
        <Pressable
          style={styles.headerSideButton}
          onPress={() => {
            Alert.alert("Leave Game?", "Are you sure you want to leave? Your team may forfeit.", [
              { text: "Stay", style: "cancel" },
              { text: "Leave", style: "destructive", onPress: () => router.back() },
            ]);
          }}
        >
          <Text style={styles.leaveText}>Leave Game</Text>
        </Pressable>
      </View>

      <View style={styles.upperArea}>
        <View style={styles.scorePill}>
          <Text style={[styles.scoreText, styles.teamAText]}>Team A: {teamAScore}</Text>
          <Text style={styles.roundText}>Round {gameState.round}</Text>
          <Text style={[styles.scoreText, styles.teamBText]}>Team B: {teamBScore}</Text>
        </View>

        <View style={styles.playersWrap}>
          {players.map((player) => {
            const isYou = player.id === user?.id;
            const canOpenAskFromPlayer = isMyTurn && player.id !== user?.id && player.team !== myPlayer?.team;
            return (
              <Pressable
                key={player.id}
                style={[
                  styles.playerPill,
                  player.team === Team.TEAM_A ? styles.playerPillA : styles.playerPillB,
                  gameState.currentTurnPlayerId === player.id && styles.playerTurnGlow,
                  isYou && styles.playerYou,
                ]}
                onPress={() => {
                  if (!canOpenAskFromPlayer) {
                    return;
                  }
                  setSelectedOpponentId(player.id);
                  setAskPanelOpen(true);
                }}
              >
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{getInitials(player.displayName)}</Text>
                </View>
                <Text style={styles.playerName} numberOfLines={1}>
                  {player.displayName}
                </Text>
                <Text style={styles.playerCount}>{player.handCount} cards</Text>
                {isYou ? <Text style={styles.youLabel}>You</Text> : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.middleArea}>
          <Text style={styles.turnText}>
            {pendingOutgoingAsk
              ? `Waiting for ${pendingOutgoingAsk.targetPlayerName}...`
              : isMyTurn
                ? "YOUR TURN"
                : `Waiting for ${currentTurnName}...`}
          </Text>
          {notificationText ? <Text style={styles.notice}>{notificationText}</Text> : null}
          {!askPanelOpen && centerAction ? (
            <Animated.Text style={[styles.latestAction, animatedActionStyle]} numberOfLines={1}>
              {centerAction}
            </Animated.Text>
          ) : null}
          <View style={styles.actionLogWrap}>{moveHistory.length > 0 ? <ActionLog moves={moveHistory} /> : null}</View>
          {!askPanelOpen && isMyTurn && !pendingOutgoingAsk ? (
            <Pressable style={styles.openAskButton} onPress={() => setAskPanelOpen(true)}>
              <Text style={styles.openAskText}>Ask</Text>
            </Pressable>
          ) : null}
          <View style={styles.myCardsPreviewWrap}>
            <FlatList
              data={myHand}
              horizontal
              keyExtractor={(item, index) => `${item.rank}-${item.suit}-${index}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.myCardsPreviewContent}
              renderItem={({ item, index }) => (
                <View
                  style={[styles.myCardsPreviewCard, index > 0 && styles.myCardsPreviewCardStacked]}
                  pointerEvents="none"
                >
                  <CardView
                    card={item}
                    faceUp
                    selected={false}
                    playable={false}
                    width={56}
                    height={82}
                  />
                </View>
              )}
            />
          </View>
          {incomingAsk ? (
            <View style={styles.responsePanelInline}>
              <Text style={styles.askTitle}>Incoming Ask</Text>
              <Text style={styles.askLabel}>
                {incomingAsk.askingPlayerName} asks for {incomingAsk.card.rank} of {incomingAsk.card.suit}
              </Text>
              <Pressable
                style={[styles.responseButton, respondingAsk && styles.askButtonDisabled]}
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
        </View>
      </View>

      <Modal visible={askPanelOpen} transparent animationType="slide" onRequestClose={() => setAskPanelOpen(false)}>
        <View style={styles.askOverlay}>
          <View style={styles.askBackdrop} />
          <SafeAreaView style={styles.askPanel}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.askPanelScrollContent}
            >
              <View style={styles.askHeader}>
                <Text style={styles.askTitle}>Ask Panel</Text>
                <Pressable style={styles.closeButtonHitbox} onPress={() => setAskPanelOpen(false)}>
                  <Text style={styles.closeText}>✕</Text>
                </Pressable>
              </View>
              <View style={styles.stepRow}>
                <StepChip text="① Your card" done={Boolean(selectedHalfSuit)} active={!selectedHalfSuit} />
                <StepChip text="② Set card" done={Boolean(selectedAskCard)} active={Boolean(selectedHalfSuit) && !selectedAskCard} />
                <StepChip text="③ Opponent" done={Boolean(selectedOpponentId)} active={Boolean(selectedAskCard) && !selectedOpponentId} />
              </View>

              <Text style={styles.askLabel}>Your cards:</Text>
              <FlatList
                data={myHand}
                horizontal
                keyExtractor={(item, index) => `${item.rank}-${item.suit}-${index}`}
                showsHorizontalScrollIndicator={false}
                removeClippedSubviews={false}
                contentContainerStyle={styles.sourceCardsContent}
                renderItem={({ item, index }) => (
                  <View style={[styles.sourceCardWrap, index > 0 && styles.sourceCardStacked]}>
                    <CardView
                      card={item}
                      faceUp
                      selected={
                        selectedSourceCardCode === `${item.rank}-${item.suit}`
                      }
                      playable={
                        selectedSourceCardCode === `${item.rank}-${item.suit}`
                      }
                      width={56}
                      height={82}
                      selectedLift={14}
                      onPress={() => {
                        if (!isMyTurn) {
                          return;
                        }
                        setSelectedSourceCardCode(`${item.rank}-${item.suit}`);
                        setSelectedHalfSuit(item.halfSuit);
                        setSelectedAskCard(null);
                      }}
                    />
                  </View>
                )}
              />

              {selectedHalfSuit ? <Text style={styles.askLabel}>Select card to ask for:</Text> : null}
              {selectedHalfSuit ? (
                <FlatList
                  data={askCardsForHalfSuit}
                  horizontal
                  keyExtractor={(item) => `${item.rank}-${item.suit}`}
                  showsHorizontalScrollIndicator={false}
                  removeClippedSubviews={false}
                  contentContainerStyle={styles.askCardsContent}
                  renderItem={({ item }) => (
                    <View style={styles.askCardWrap}>
                      <CardView
                        card={item}
                        faceUp
                        selected={selectedAskCard?.rank === item.rank && selectedAskCard?.suit === item.suit}
                        playable={selectedAskCard?.rank === item.rank && selectedAskCard?.suit === item.suit}
                        width={54}
                        height={80}
                        selectedLift={10}
                        onPress={() => {
                          if (!isMyTurn) {
                            return;
                          }
                          setSelectedAskCard(item);
                        }}
                      />
                    </View>
                  )}
                />
              ) : null}

              <Text style={styles.askLabel}>Select opponent to ask:</Text>
              <FlatList
                data={askableOpponents}
                horizontal
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.opponentContent}
                renderItem={({ item }) => (
                  <Pressable
                    style={[
                      styles.opponentPill,
                      item.team === Team.TEAM_B ? styles.opponentRed : styles.opponentBlue,
                      selectedOpponentId === item.id && styles.opponentSelected,
                    ]}
                    onPress={() => setSelectedOpponentId(item.id)}
                  >
                    <Text style={styles.opponentText}>{item.displayName}</Text>
                  </Pressable>
                )}
              />
              {selectedOpponentId ? <Text style={styles.selectedOpponent}>Opponent: {selectedOpponentName}</Text> : null}

              <View style={styles.askActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => {
                    setAskPanelOpen(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.askButton, !canSubmitAsk && styles.askButtonDisabled]}
                  disabled={!canSubmitAsk}
                  onPress={() => {
                    void submitAsk();
                  }}
                >
                  <Text style={styles.askButtonText}>{submitting ? "Asking..." : "Ask"}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingHorizontal: 8, paddingBottom: 8 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0f172a" },
  loadingText: { color: "#f1f5f9", marginTop: 8 },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#0f172a",
  },
  headerSideButton: {
    minWidth: 72,
  },
  headerSideText: {
    color: "#f59e0b",
    fontWeight: "800",
    fontSize: 18,
  },
  leaveText: {
    color: "#ef4444",
    fontWeight: "800",
    fontSize: 16,
    textAlign: "right",
  },
  headerRoomPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#f59e0b",
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  headerRoomText: {
    color: "#f59e0b",
    fontWeight: "800",
    fontSize: 16,
  },
  upperArea: { flex: 1, paddingHorizontal: 4, paddingTop: 6, paddingBottom: 130, gap: 8 },
  scorePill: {
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#f59e0b",
    backgroundColor: "rgba(15,23,42,0.74)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    alignSelf: "center",
    paddingHorizontal: 12,
  },
  scoreText: { fontWeight: "800", fontSize: 12 },
  roundText: { color: "#f59e0b", fontWeight: "900", fontSize: 13 },
  teamAText: { color: "#3b82f6" },
  teamBText: { color: "#ef4444" },
  playersWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between" },
  playerPill: {
    width: "48%",
    borderRadius: 10,
    borderWidth: 1,
    padding: 6,
    alignItems: "center",
    gap: 2,
  },
  playerPillA: { borderColor: "rgba(59,130,246,0.5)", backgroundColor: "rgba(59,130,246,0.15)" },
  playerPillB: { borderColor: "rgba(239,68,68,0.5)", backgroundColor: "rgba(239,68,68,0.15)" },
  playerTurnGlow: {
    borderColor: "#f59e0b",
    shadowColor: "#f59e0b",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  playerYou: { transform: [{ scale: 1.03 }] },
  avatarCircle: { width: 40, height: 40, borderRadius: 999, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#f1f5f9", fontWeight: "900", fontSize: 13 },
  playerName: { color: "#f1f5f9", fontWeight: "700", fontSize: 11, textAlign: "center" },
  playerCount: { color: "#cbd5e1", fontSize: 10 },
  youLabel: {
    color: "#111827",
    backgroundColor: "#f59e0b",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    fontSize: 10,
    fontWeight: "800",
  },
  middleArea: { flex: 1, gap: 6 },
  turnText: { backgroundColor: "#f59e0b", color: "#111827", textAlign: "center", fontWeight: "900", borderRadius: 999, paddingVertical: 8 },
  notice: { color: "#fde68a", textAlign: "center", fontWeight: "700", fontSize: 12 },
  latestAction: { color: "#f1f5f9", textAlign: "center", fontSize: 12 },
  actionLogWrap: { maxHeight: 88 },
  openAskButton: {
    alignSelf: "center",
    borderRadius: 999,
    backgroundColor: "#f59e0b",
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 2,
  },
  openAskText: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 14,
  },
  myCardsPreviewWrap: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "rgba(15,23,42,0.85)",
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  myCardsPreviewContent: {
    gap: 0,
    paddingRight: 6,
    paddingLeft: 4,
    alignItems: "flex-end",
  },
  myCardsPreviewCard: {
    overflow: "visible",
  },
  myCardsPreviewCardStacked: {
    marginLeft: -20,
  },
  handDock: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 0,
    height: 110,
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    paddingBottom: 8,
    paddingTop: 20,
    justifyContent: "center",
    zIndex: 20,
    overflow: "visible",
  },
  handContent: { paddingHorizontal: 8, paddingTop: 16, alignItems: "flex-end", overflow: "visible" },
  handCardWrap: { overflow: "visible" },
  handCardStack: { marginLeft: -20 },
  askPanel: {
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 8,
    height: "96%",
    maxHeight: "96%",
    backgroundColor: "#1e293b",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    zIndex: 100,
    overflow: "visible",
  },
  askOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  askBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  askPanelScrollContent: {
    paddingTop: 10,
    paddingHorizontal: 6,
    paddingBottom: 24,
    gap: 8,
    overflow: "visible",
  },
  sourceCardsContent: {
    gap: 0,
    paddingRight: 4,
    overflow: "visible",
    paddingTop: 18,
    paddingBottom: 8,
    alignItems: "flex-end",
  },
  sourceCardWrap: {
    overflow: "visible",
  },
  sourceCardStacked: {
    marginLeft: -18,
  },
  askHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    paddingLeft: 2,
    paddingRight: 4,
    marginBottom: 2,
  },
  askTitle: { color: "#f1f5f9", fontWeight: "800", fontSize: 18 },
  closeButtonHitbox: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginRight: 2,
  },
  closeText: { color: "#f59e0b", fontWeight: "900", fontSize: 16 },
  stepRow: { flexDirection: "row", gap: 6 },
  stepChip: { borderRadius: 999, borderWidth: 1, borderColor: "#475569", backgroundColor: "#0f172a", paddingHorizontal: 8, paddingVertical: 4 },
  stepChipDone: { borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.15)" },
  stepChipActive: { borderColor: "#f59e0b" },
  stepChipText: { color: "#94a3b8", fontWeight: "700", fontSize: 11 },
  stepChipTextDone: { color: "#f59e0b" },
  askLabel: { color: "#cbd5e1", fontWeight: "700", fontSize: 12 },
  opponentContent: { gap: 8, paddingRight: 4 },
  opponentPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  opponentRed: { borderColor: "#dc2626", backgroundColor: "rgba(220,38,38,0.18)" },
  opponentBlue: { borderColor: "#1e293b", backgroundColor: "rgba(30,41,59,0.75)" },
  opponentSelected: { borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.2)" },
  opponentText: { color: "#f1f5f9", fontWeight: "700", fontSize: 12 },
  selectedOpponent: { color: "#f59e0b", fontWeight: "700", fontSize: 12 },
  askCardsContent: {
    gap: 6,
    paddingRight: 4,
    paddingTop: 18,
    paddingBottom: 14,
    minHeight: 98,
    alignItems: "flex-end",
    overflow: "visible",
  },
  askCardWrap: { overflow: "visible", paddingBottom: 2 },
  askActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 10, paddingBottom: 2 },
  cancelButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#64748b",
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  cancelButtonText: {
    color: "#cbd5e1",
    fontWeight: "700",
  },
  askButton: { borderRadius: 10, backgroundColor: "#f59e0b", paddingHorizontal: 18, paddingVertical: 9 },
  askButtonDisabled: { opacity: 0.5 },
  askButtonText: { color: "#111827", fontWeight: "800" },
  responsePanel: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 112,
    borderRadius: 12,
    backgroundColor: "rgba(2,6,23,0.95)",
    borderWidth: 1,
    borderColor: "#22c55e",
    padding: 10,
    gap: 8,
    zIndex: 120,
  },
  responsePanelInline: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: "rgba(2,6,23,0.95)",
    borderWidth: 1,
    borderColor: "#22c55e",
    padding: 10,
    gap: 8,
  },
  responseButton: { borderRadius: 8, backgroundColor: "#0f766e", alignItems: "center", justifyContent: "center", paddingVertical: 10 },
  responseButtonText: { color: "#fff", fontWeight: "700" },
});
