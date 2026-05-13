import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { HalfSuit, MoveType, type Card, type Move, Team } from "@shared/src";

import { CardView } from "../../components/cards/CardView";
import { CardDisplay } from "../../components/cards/CardDisplay";
import { ActionLog } from "../../components/game/ActionLog";
import { useGameState } from "../../hooks/useGameState";
import { respondToAsk } from "../../services/gameService";
import { socketService } from "../../services/socket";
import { useAuthStore } from "../../store/authStore";
import { useGameStore } from "../../store/gameStore";
import { cardToCode, getHalfSuit, getHalfSuitCards } from "../../utils/cardHelpers";
import { formatDisplayName } from "../../utils/nameHelpers";
import { confirmLeaveGame } from "../../utils/leaveGameSession";
import { playSfx } from "../../services/soundEffects";

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

interface DeclarationStartedPayload {
  gameId: string;
  declaringPlayerId: string;
  declaringPlayerName: string;
  halfSuit: HalfSuit;
  declaredCardsByPlayer: Array<{
    playerId: string;
    playerName: string;
    cards: Array<Card & { code?: string }>;
  }>;
}

interface DeclarationResultPayload {
  gameId: string;
  declaringPlayerId: string;
  declaringPlayerName: string;
  halfSuit: HalfSuit;
  success: boolean;
  scoreDelta: number;
  declaringTeam: Team;
  newScore: number;
  claimedTeam?: Team;
  message: string;
  subMessage?: string;
}

interface AskAnnouncementPayload {
  actorName: string;
  targetName: string;
  card: Card;
  kind: "ASK_REQUESTED" | "ASK_GIVE" | "ASK_NO";
}

interface GameOverPayload {
  winner: Team | "DRAW";
  teamABooks: number;
  teamBBooks: number;
  scores: Record<string, number>;
  gameStatus?: string;
}

interface GameEvent {
  type: "declare_success" | "declare_fail" | "ask_success" | "ask_fail" | "game_over";
  title: string;
  message: string;
  subMessage?: string;
  autoCloseMs?: number;
}

const getInitials = (name?: string | null): string =>
  (name ?? "Player")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("") || "P";

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
  const lastAskResult = useGameStore((state) => state.lastAskResult);
  const setLastAskResult = useGameStore((state) => state.setLastAskResult);
  const lastDeclareResult = useGameStore((state) => state.lastDeclareResult);
  const setLastDeclareResult = useGameStore((state) => state.setLastDeclareResult);
  const gameOverData = useGameStore((state) => state.gameOverData);
  const setGameOver = useGameStore((state) => state.setGameOver);
  const modalLocked = useGameStore((state) => state.modalLocked);
  const setModalLocked = useGameStore((state) => state.setModalLocked);

  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);
  const [selectedHalfSuit, setSelectedHalfSuit] = useState<HalfSuit | null>(null);
  const [selectedSourceCardCode, setSelectedSourceCardCode] = useState<string | null>(null);
  const [selectedAskCard, setSelectedAskCard] = useState<Card | null>(null);
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  const [notificationText, setNotificationText] = useState<string | null>(null);
  const [incomingAsk, setIncomingAsk] = useState<IncomingAsk | null>(null);
  const [pendingOutgoingAsk, setPendingOutgoingAsk] = useState<PendingOutgoingAsk | null>(null);
  const [askPendingGlobal, setAskPendingGlobal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [respondingAsk, setRespondingAsk] = useState(false);
  const [askPanelOpen, setAskPanelOpen] = useState(false);
  const [askPanelEnabled, setAskPanelEnabled] = useState(true);
  const [declarePanelOpen, setDeclarePanelOpen] = useState(false);
  const [selectedDeclareHalfSuit, setSelectedDeclareHalfSuit] = useState<HalfSuit | null>(null);
  const [submittingDeclare, setSubmittingDeclare] = useState(false);
  const [declarationPopup, setDeclarationPopup] = useState<DeclarationStartedPayload | null>(null);
  const [askAnnouncementPopup, setAskAnnouncementPopup] = useState<AskAnnouncementPayload | null>(null);
  const [gameEventQueue, setGameEventQueue] = useState<GameEvent[]>([]);
  const [currentGameEvent, setCurrentGameEvent] = useState<GameEvent | null>(null);
  const [gameEventVisible, setGameEventVisible] = useState(false);
  const [panelLocked, setPanelLocked] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [declareActionsBlocked, setDeclareActionsBlocked] = useState(false);
  const [declareTimerPaused, setDeclareTimerPaused] = useState(false);

  const moveExpiryTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const declarationPopupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const declarationResultDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameEventTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const askAnnouncementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const askPanelEnableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const askAnnouncementDismissedAtRef = useRef(0);
  const askAnnouncementLastKeyRef = useRef<string | null>(null);
  const previousHandCountsRef = useRef<Record<string, number>>({});
  const announcedOutOfCardsRef = useRef<Set<string>>(new Set());
  const suppressNextSelfOutOfCardsPopupRef = useRef(false);
  const declareActionsBlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const declareTimerPauseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionSlideY = useSharedValue(12);
  const actionOpacity = useSharedValue(0);
  const declarationPulse = useSharedValue(0.55);

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

  const startDeclareActionCooldown = (): void => {
    setDeclareActionsBlocked(true);
    if (declareActionsBlockTimerRef.current) {
      clearTimeout(declareActionsBlockTimerRef.current);
    }
    declareActionsBlockTimerRef.current = setTimeout(() => {
      setDeclareActionsBlocked(false);
      declareActionsBlockTimerRef.current = null;
    }, 15000);
  };

  const startDeclareTimerPause = (): void => {
    setDeclareTimerPaused(true);
    if (declareTimerPauseRef.current) {
      clearTimeout(declareTimerPauseRef.current);
    }
    declareTimerPauseRef.current = setTimeout(() => {
      setDeclareTimerPaused(false);
      declareTimerPauseRef.current = null;
    }, 15000);
  };

  const openAskAnnouncementPopup = (payload: AskAnnouncementPayload): void => {
    const now = Date.now();
    const popupKey = `${payload.kind}:${payload.actorName}:${payload.targetName}:${payload.card.rank}:${payload.card.suit}`;
    if (now - askAnnouncementDismissedAtRef.current < 900) {
      return;
    }
    if (askAnnouncementLastKeyRef.current === popupKey) {
      return;
    }
    askAnnouncementLastKeyRef.current = popupKey;
    if (askAnnouncementTimerRef.current) {
      clearTimeout(askAnnouncementTimerRef.current);
    }
    setAskAnnouncementPopup(payload);
    askAnnouncementTimerRef.current = setTimeout(() => {
      markPopupRecentlyClosed();
      setAskAnnouncementPopup(null);
      askAnnouncementLastKeyRef.current = null;
      askAnnouncementTimerRef.current = null;
    }, 5000);
  };

  const markPopupRecentlyClosed = (): void => {
    askAnnouncementDismissedAtRef.current = Date.now();
    askAnnouncementLastKeyRef.current = null;
  };

  const closeAllPanels = (): void => {
    setDeclarePanelOpen(false);
    setAskPanelOpen(false);
    setSelectedOpponentId(null);
    setSelectedAskCard(null);
    setSelectedHalfSuit(null);
    setGameEventVisible(false);
  };

  const reEnableAskPanelWithDelay = (): void => {
    if (askPanelEnableTimerRef.current) {
      clearTimeout(askPanelEnableTimerRef.current);
    }
    askPanelEnableTimerRef.current = setTimeout(() => {
      setAskPanelEnabled(true);
      askPanelEnableTimerRef.current = null;
    }, 300);
  };

  const lockPanels = (): void => {
    setPanelLocked(true);
    if (panelUnlockTimerRef.current) {
      clearTimeout(panelUnlockTimerRef.current);
    }
    panelUnlockTimerRef.current = setTimeout(() => {
      setPanelLocked(false);
      panelUnlockTimerRef.current = null;
    }, 400);
  };

  const enqueueGameEvent = (event: GameEvent): void => {
    setGameEventQueue((current) => {
      if (current.length > 0) {
        const last = current[current.length - 1];
        if (last.type.startsWith("declare") && event.type.startsWith("declare")) {
          const mergedSubMessage = [last.subMessage, event.subMessage].filter(Boolean).join("\n");
          return [...current.slice(0, -1), { ...last, subMessage: mergedSubMessage || undefined }];
        }
      }
      return [...current, event];
    });
  };

  const handleCloseGameEvent = (): void => {
    playSfx("tap");
    if (gameEventTimerRef.current) {
      clearTimeout(gameEventTimerRef.current);
      gameEventTimerRef.current = null;
    }
    markPopupRecentlyClosed();
    lockPanels();
    setAskPanelEnabled(false);
    closeAllPanels();
    setCurrentGameEvent(null);
    reEnableAskPanelWithDelay();
  };

  const closeModal = useCallback(() => {
    // Lock first so incoming socket updates do not immediately reopen UI.
    setModalLocked(true);

    // Clear all panel/modal state in one pass to avoid flicker between states.
    setLastAskResult(null);
    setLastDeclareResult(null);
    setAskPanelOpen(false);
    setDeclarePanelOpen(false);
    setSelectedOpponentId(null);
    setSelectedAskCard(null);
    setSelectedHalfSuit(null);
    setSelectedDeclareHalfSuit(null);
    setSelectedSourceCardCode(null);

    setTimeout(() => {
      setModalLocked(false);
    }, 1000);
  }, [setLastAskResult, setLastDeclareResult, setModalLocked]);

  useEffect(() => {
    if (!lastAskResult) {
      return;
    }
    setAskPendingGlobal(false);
    setPendingOutgoingAsk(null);
    setIncomingAsk(null);
    setAskPanelOpen(false);
  }, [lastAskResult]);

  useEffect(() => {
    if (!lastAskResult) {
      return;
    }
    const timer = setTimeout(() => closeModal(), 10000);
    return () => {
      clearTimeout(timer);
    };
  }, [lastAskResult, closeModal]);

  useEffect(() => {
    if (!lastDeclareResult) {
      return;
    }
    const timer = setTimeout(() => closeModal(), 6000);
    return () => {
      clearTimeout(timer);
    };
  }, [lastDeclareResult, closeModal]);

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
      setAskPendingGlobal(true);
      if (payload.targetPlayerId === user?.id) {
        setIncomingAsk(payload);
      }
      if (payload.askingPlayerId === user?.id) {
        setPendingOutgoingAsk({ targetPlayerId: payload.targetPlayerId, targetPlayerName: payload.targetPlayerName });
      } else {
        openAskAnnouncementPopup({
          actorName: payload.askingPlayerName,
          targetName: payload.targetPlayerName,
          card: payload.card,
          kind: "ASK_REQUESTED",
        });
      }
    });
    const offDeclarationStarted = socketService.on<DeclarationStartedPayload>("game:declaration_started", (payload) => {
      startDeclareTimerPause();
      if (payload.declaringPlayerId === user?.id) {
        return;
      }
      setDeclarationPopup(payload);
      if (declarationPopupTimerRef.current) {
        clearTimeout(declarationPopupTimerRef.current);
      }
      declarationPopupTimerRef.current = setTimeout(() => {
        markPopupRecentlyClosed();
        setDeclarationPopup(null);
        declarationPopupTimerRef.current = null;
      }, 15000);
    });
    return () => {
      offAskRequested();
      offDeclarationStarted();
    };
  }, [router, user?.id]);

  useEffect(() => {
    if (!declarationPopup && !gameEventVisible) {
      declarationPulse.value = 0.55;
      return;
    }
    declarationPulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [declarationPopup, declarationPulse, gameEventVisible]);

  useEffect(() => {
    if (gameEventVisible || currentGameEvent || gameEventQueue.length === 0) {
      return;
    }
    const [nextEvent, ...rest] = gameEventQueue;
    setGameEventQueue(rest);
    setCurrentGameEvent(nextEvent);
    setGameEventVisible(true);
    if (gameEventTimerRef.current) {
      clearTimeout(gameEventTimerRef.current);
    }
    gameEventTimerRef.current = setTimeout(() => {
      handleCloseGameEvent();
      gameEventTimerRef.current = null;
    }, nextEvent.autoCloseMs ?? 5000);
  }, [currentGameEvent, gameEventQueue, gameEventVisible]);

  const handleGameOverClose = (): void => {
    lockPanels();
    setGameOver(null);
    router.replace("/(tabs)/");
  };

  useEffect(() => {
    if (!gameOverData) {
      return;
    }
    setCountdown(10);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleGameOverClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [gameOverData]);

  useEffect(() => {
    return () => {
      Object.values(moveExpiryTimersRef.current).forEach((timer) => clearTimeout(timer));
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
      if (declarationPopupTimerRef.current) {
        clearTimeout(declarationPopupTimerRef.current);
      }
      if (declarationResultDelayTimerRef.current) {
        clearTimeout(declarationResultDelayTimerRef.current);
      }
      if (gameEventTimerRef.current) {
        clearTimeout(gameEventTimerRef.current);
      }
      if (askAnnouncementTimerRef.current) {
        clearTimeout(askAnnouncementTimerRef.current);
      }
      if (askPanelEnableTimerRef.current) {
        clearTimeout(askPanelEnableTimerRef.current);
      }
      if (panelUnlockTimerRef.current) {
        clearTimeout(panelUnlockTimerRef.current);
      }
      if (declareActionsBlockTimerRef.current) {
        clearTimeout(declareActionsBlockTimerRef.current);
      }
      if (declareTimerPauseRef.current) {
        clearTimeout(declareTimerPauseRef.current);
      }
    };
  }, []);

  const players = gameState?.players ?? [];
  const myPlayer = players.find((player) => player.id === user?.id) ?? null;
  const isSpectator = Boolean(myPlayer && myPlayer.handCount <= 0);
  const isMyTurn = Boolean(user?.id && gameState?.currentTurnPlayerId === user.id);
  const teamAScore = gameState?.scores?.[Team.TEAM_A] ?? 0;
  const teamBScore = gameState?.scores?.[Team.TEAM_B] ?? 0;
  const currentTurnName =
    formatDisplayName(players.find((player) => player.id === gameState?.currentTurnPlayerId)?.displayName ?? "Unknown");

  const askableOpponents = useMemo(() => {
    if (!myPlayer) {
      return players.filter((player) => player.handCount > 0);
    }
    return players.filter(
      (player) => player.id !== myPlayer.id && player.team !== myPlayer.team && player.handCount > 0,
    );
  }, [myPlayer, players]);

  const selectedOpponentName =
    formatDisplayName(askableOpponents.find((player) => player.id === selectedOpponentId)?.displayName ?? "none");
  const isTurnTimerHidden = askPendingGlobal || declareTimerPaused;
  const effectiveTurnPlayerId = gameState?.currentTurnPlayerId;
  const effectiveTurnName =
    formatDisplayName(players.find((player) => player.id === effectiveTurnPlayerId)?.displayName ?? currentTurnName);
  const displayIsMyTurn = Boolean(user?.id && effectiveTurnPlayerId === user.id);
  const canUseTurnButtons =
    displayIsMyTurn &&
    !pendingOutgoingAsk &&
    !declareActionsBlocked &&
    !isSpectator &&
    askPanelEnabled &&
    !gameEventVisible &&
    !gameOverData &&
    !panelLocked &&
    !lastAskResult &&
    !lastDeclareResult;

  const askCardsForHalfSuit = useMemo(() => {
    if (!selectedHalfSuit || typeof selectedHalfSuit !== "string" || !selectedHalfSuit.includes("_")) {
      return [];
    }
    const splitParts = selectedHalfSuit.split("_");
    if (splitParts.length < 2) {
      return [];
    }
    const suitToken = splitParts[1];
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
  const declareGroups = useMemo(() => {
    const grouped = myHand.reduce<Record<HalfSuit, Card[]>>((acc, card) => {
      const key = card.halfSuit as HalfSuit;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(card);
      return acc;
    }, {} as Record<HalfSuit, Card[]>);

    return Object.entries(grouped)
      .map(([halfSuit, cards]) => ({
        halfSuit: halfSuit as HalfSuit,
        cards,
      }))
      .sort((a, b) => b.cards.length - a.cards.length);
  }, [myHand]);

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
    displayIsMyTurn && !isSpectator && selectedOpponentId && selectedHalfSuit && selectedAskCard && !submitting,
  );

  useEffect(() => {
    if (players.length === 0) {
      return;
    }
    const currentHandCounts = players.reduce<Record<string, number>>((acc, player) => {
      acc[player.id] = player.handCount;
      return acc;
    }, {});

    if (Object.keys(previousHandCountsRef.current).length === 0) {
      previousHandCountsRef.current = currentHandCounts;
      return;
    }

    players.forEach((player) => {
      const previousCount = previousHandCountsRef.current[player.id];
      if (
        typeof previousCount === "number" &&
        previousCount > 0 &&
        player.handCount <= 0 &&
        !announcedOutOfCardsRef.current.has(player.id)
      ) {
        announcedOutOfCardsRef.current.add(player.id);
        const teammate = players.find(
          (candidate) =>
            candidate.team === player.team &&
            candidate.id !== player.id &&
            candidate.handCount > 0,
        );
        const passMessage = `${formatDisplayName(player.displayName)} has no more cards${
          teammate ? ` — turn passes to ${formatDisplayName(teammate.displayName)}` : ""
        }`;
        if (player.id === user?.id) {
          if (suppressNextSelfOutOfCardsPopupRef.current) {
            suppressNextSelfOutOfCardsPopupRef.current = false;
            return;
          }
          enqueueGameEvent({
            type: "ask_fail",
            title: "Spectator Mode",
            message: "You have no more cards and can now spectate.",
            subMessage: passMessage,
            autoCloseMs: 5000,
          });
        } else {
          let mergedIntoDeclare = false;
          setCurrentGameEvent((current) => {
            if (!current || !current.type.startsWith("declare")) {
              return current;
            }
            mergedIntoDeclare = true;
            const mergedSubMessage = [current.subMessage, passMessage].filter(Boolean).join("\n");
            return { ...current, subMessage: mergedSubMessage };
          });
          if (!mergedIntoDeclare) {
            enqueueGameEvent({
              type: "ask_fail",
              title: "Player Update",
              message: passMessage,
              autoCloseMs: 5000,
            });
          }
        }
      }
    });

    previousHandCountsRef.current = currentHandCounts;
  }, [players, user?.id]);

  const submitAsk = async (): Promise<void> => {
    if (!gameState?.id || !selectedOpponentId || !selectedAskCard || !displayIsMyTurn || isSpectator) {
      return;
    }
    setSubmitting(true);
    try {
      playSfx("confirm");
      socketService.emit("game:play_card", {
        gameId: gameState.id,
        roomCode: code,
        targetPlayerId: selectedOpponentId,
        card: selectedAskCard,
      });
      setSelectedOpponentId(null);
      setSelectedHalfSuit(null);
      setSelectedSourceCardCode(null);
      setSelectedAskCard(null);
      setAskPanelOpen(false);
    } catch {
      playSfx("error");
      Alert.alert("Ask Error", "Failed to ask.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAskPanel = useCallback((): void => {
    if (!isMyTurn || isSpectator || submitting || Boolean(lastAskResult)) {
      return;
    }
    setSelectedOpponentId(null);
    setSelectedAskCard(null);
    setSelectedHalfSuit(null);
    setSelectedSourceCardCode(null);
    playSfx("tap");
    setAskPanelOpen(true);
  }, [isMyTurn, isSpectator, submitting, lastAskResult]);

  const handleDeclare = async (halfSuit: HalfSuit): Promise<void> => {
    if (!gameState?.id || !isMyTurn || isSpectator) {
      return;
    }
    console.log("Declare attempt:", {
      gameId: gameState?.id,
      roomCode: code,
      halfSuit,
      isMyTurn,
    });
    setSubmittingDeclare(true);
    try {
      playSfx("confirm");
      socketService.emit("game:declare", {
        gameId: gameState.id,
        roomCode: code,
        halfSuit,
      });
      setDeclarePanelOpen(false);
      setSelectedDeclareHalfSuit(null);
    } catch (e) {
      playSfx("error");
      console.log("Declare error:", e);
      Alert.alert("Declare Error", "Failed to declare.");
    } finally {
      setSubmittingDeclare(false);
    }
  };

  const respondIncomingAsk = async (): Promise<void> => {
    if (!incomingAsk) {
      return;
    }
    setRespondingAsk(true);
    try {
      playSfx("confirm");
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
      playSfx("error");
      Alert.alert("Response Error", error instanceof Error ? error.message : "Failed to respond.");
    } finally {
      setRespondingAsk(false);
    }
  };

  const animatedActionStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: actionSlideY.value }],
    opacity: actionOpacity.value,
  }));
  const declarationGlowStyle = useAnimatedStyle(() => ({
    opacity: declarationPulse.value,
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
            confirmLeaveGame(code ?? "");
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
            const canOpenAskFromPlayer = canUseTurnButtons && player.id !== user?.id && player.team !== myPlayer?.team;
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
                  if (askPanelOpen) {
                    setSelectedOpponentId(player.id);
                    return;
                  }
                  if (!displayIsMyTurn || !askPanelEnabled || gameEventVisible) {
                    return;
                  }
                }}
              >
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{getInitials(formatDisplayName(player.displayName))}</Text>
                </View>
                <Text style={styles.playerName} numberOfLines={1}>
                  {formatDisplayName(player.displayName)}
                </Text>
                {/* Coins UI hidden for now — restore when implementing:
                <Text style={styles.playerCoins}>🪙 {player.coins ?? 0}</Text>
                */}
                <Text style={styles.playerCount}>{player.handCount} cards</Text>
                {isYou ? <Text style={styles.youLabel}>You</Text> : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.middleArea}>
          {!(displayIsMyTurn && isSpectator) ? (
            <Text style={styles.turnText}>
              {pendingOutgoingAsk
                ? `Waiting for ${formatDisplayName(pendingOutgoingAsk.targetPlayerName)}...`
                : displayIsMyTurn
                  ? "YOUR TURN"
                  : `Waiting for ${effectiveTurnName}'s turn`}
            </Text>
          ) : null}
          {notificationText ? <Text style={styles.notice}>{notificationText}</Text> : null}
          {!askPanelOpen && centerAction ? (
            <Animated.Text style={[styles.latestAction, animatedActionStyle]} numberOfLines={1}>
              {centerAction}
            </Animated.Text>
          ) : null}
          <View style={styles.actionLogWrap}>{moveHistory.length > 0 ? <ActionLog moves={moveHistory} /> : null}</View>
          {!askPanelOpen && canUseTurnButtons ? (
            <View style={styles.askTimerSection}>
              <View style={styles.turnActionRow}>
                <Pressable
                  style={[
                    styles.openAskButton,
                    (!isMyTurn || submitting || !!lastAskResult) && styles.askButtonDisabled,
                  ]}
                  onPress={handleOpenAskPanel}
                  disabled={!isMyTurn || submitting || !!lastAskResult}
                >
                  <Text style={styles.openAskText}>Ask</Text>
                </Pressable>
                <Pressable
                  style={styles.declareSetButton}
                  onPress={() => {
                    playSfx("tap");
                    setDeclarePanelOpen(true);
                  }}
                >
                  <Text style={styles.declareSetText}>Declare a set</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {displayIsMyTurn && declareActionsBlocked ? (
            <Text style={styles.timeWarning}>Declaration resolving... actions unlock in 15s.</Text>
          ) : null}
          {displayIsMyTurn && isSpectator ? (
            <Text style={styles.timeWarning}>You are spectating. Ask/Declare are disabled.</Text>
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
                {formatDisplayName(incomingAsk.askingPlayerName)} asks for {incomingAsk.card.rank} of {incomingAsk.card.suit}
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

      <Modal
        visible={askPanelOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          closeModal();
        }}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
          onPress={() => {
            closeModal();
          }}
        >
          <Pressable
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "#1e293b",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              maxHeight: "80%",
            }}
            onPress={(event) => event.stopPropagation()}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.askPanelScrollContent}
            >
              <View style={styles.askHeader}>
                <Text style={styles.askTitle}>Ask Panel</Text>
                <Pressable
                  style={styles.closeButtonHitbox}
                  onPress={() => {
                    closeModal();
                  }}
                >
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
                        if (!displayIsMyTurn) {
                          return;
                        }
                        setSelectedSourceCardCode(`${item.rank}-${item.suit}`);
                        setSelectedHalfSuit((item.halfSuit as HalfSuit | undefined) ?? null);
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
                          if (!displayIsMyTurn) {
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
                    <Text style={styles.opponentText}>{formatDisplayName(item.displayName)}</Text>
                  </Pressable>
                )}
              />
              {selectedOpponentId ? <Text style={styles.selectedOpponent}>Opponent: {selectedOpponentName}</Text> : null}

              <View style={styles.askActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => {
                    closeModal();
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
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={declarePanelOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setDeclarePanelOpen(false);
          setSelectedDeclareHalfSuit(null);
          setSelectedHalfSuit(null);
        }}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
          onPress={() => {
            setDeclarePanelOpen(false);
            setSelectedDeclareHalfSuit(null);
            setSelectedHalfSuit(null);
          }}
        >
          <Pressable
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "#1e293b",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              maxHeight: "80%",
            }}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.declareHeader}>
              <Text style={styles.askTitle}>Declare a set</Text>
              <Pressable
                style={styles.closeButtonHitbox}
                onPress={() => {
                  setDeclarePanelOpen(false);
                  setSelectedDeclareHalfSuit(null);
                  setSelectedHalfSuit(null);
                }}
              >
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>
            <View style={styles.declareContentInset}>
              <Text style={styles.askLabel}>Choose one grouped set from your cards:</Text>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.declareGroupsListContent}
              >
                {declareGroups.map((group) => (
                  <Pressable
                    key={group.halfSuit}
                    style={[
                      styles.declareGroupWrap,
                      selectedDeclareHalfSuit === group.halfSuit ? styles.declareGroupWrapActive : null,
                    ]}
                    onPress={() => setSelectedDeclareHalfSuit(group.halfSuit)}
                  >
                    <View style={styles.declareGroupColumn}>
                      {group.cards.map((card) => (
                        <View key={`${group.halfSuit}-${card.rank}-${card.suit}`} style={styles.declareGroupCardVertical}>
                          <CardView
                            card={card}
                            faceUp
                            selected={selectedDeclareHalfSuit === group.halfSuit}
                            playable={selectedDeclareHalfSuit === group.halfSuit}
                            width={58}
                            height={82}
                            selectedLift={6}
                          />
                        </View>
                      ))}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
              {selectedDeclareHalfSuit ? (
                <Text style={styles.declareWarningText}>This will affect your team score!</Text>
              ) : null}
              <View style={styles.askActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => {
                    setDeclarePanelOpen(false);
                    setSelectedDeclareHalfSuit(null);
                    setSelectedHalfSuit(null);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.askButton, (!selectedDeclareHalfSuit || submittingDeclare) && styles.askButtonDisabled]}
                  disabled={!selectedDeclareHalfSuit || submittingDeclare}
                  onPress={() => {
                    if (!selectedDeclareHalfSuit) {
                      return;
                    }
                    void handleDeclare(selectedDeclareHalfSuit);
                  }}
                >
                  <Text style={styles.askButtonText}>{submittingDeclare ? "Declaring..." : "Confirm Declare"}</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(declarationPopup)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          markPopupRecentlyClosed();
          setAskPanelEnabled(false);
          closeAllPanels();
          setDeclarationPopup(null);
          lockPanels();
          reEnableAskPanelWithDelay();
        }}
      >
        <View style={styles.declarationOverlay}>
          <Animated.View style={[styles.declarationGlowLayer, declarationGlowStyle]} />
          <View style={[styles.declarationCard, styles.declarationAlertCard]}>
            <Text style={[styles.declarationTitle, styles.declarationAlertTitle]}>
              Declaration Alert
            </Text>
            <Text style={styles.declarationAlertSubTitle}>
              {formatDisplayName(declarationPopup?.declaringPlayerName)} declared a set
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.declarationScrollContent}>
              {(declarationPopup?.declaredCardsByPlayer ?? []).map((holder) => (
                <View key={holder.playerId} style={styles.declarationHolderBlock}>
                  <Text style={styles.declarationHolderName}>{holder.playerName} has:</Text>
                  <View style={styles.declarationCardsRow}>
                    {holder.cards.map((card, index) => (
                      <View key={`${holder.playerId}-${card.rank}-${card.suit}-${index}`} style={styles.declarationCardWrap}>
                        <CardView card={card} faceUp playable={false} selected={false} width={56} height={82} />
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
            <Pressable
              style={styles.declarationDismissButton}
              onPress={() => {
                markPopupRecentlyClosed();
                setAskPanelEnabled(false);
                closeAllPanels();
                setDeclarationPopup(null);
                if (declarationPopupTimerRef.current) {
                  clearTimeout(declarationPopupTimerRef.current);
                  declarationPopupTimerRef.current = null;
                }
                lockPanels();
                reEnableAskPanelWithDelay();
              }}
            >
              <Text style={styles.declarationDismissText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={gameEventVisible && Boolean(currentGameEvent)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          handleCloseGameEvent();
        }}
      >
        <View style={styles.declarationOverlay}>
          <Animated.View
            style={[
              styles.declarationGlowLayer,
              declarationGlowStyle,
              currentGameEvent?.type === "declare_success" || currentGameEvent?.type === "ask_success"
                ? styles.declarationGlowSuccess
                : styles.declarationGlowFail,
            ]}
          />
          <View
            style={[
              styles.declarationCard,
              currentGameEvent?.type === "declare_success" || currentGameEvent?.type === "ask_success"
                ? styles.resultSuccess
                : styles.resultFail,
            ]}
          >
            <Text style={styles.declarationTitle}>{currentGameEvent?.title}</Text>
            <Text style={styles.resultText}>{currentGameEvent?.message}</Text>
            {currentGameEvent?.subMessage ? <Text style={styles.resultText}>{currentGameEvent.subMessage}</Text> : null}
            <Pressable style={styles.declarationDismissButton} onPress={handleCloseGameEvent}>
              <Text style={styles.declarationDismissText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(askAnnouncementPopup)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          markPopupRecentlyClosed();
          setAskPanelEnabled(false);
          closeAllPanels();
          setAskAnnouncementPopup(null);
          lockPanels();
          reEnableAskPanelWithDelay();
        }}
      >
        <View style={styles.askAnnouncementOverlay}>
          {(() => {
            const askKind = askAnnouncementPopup?.kind;
            const cardToneStyle =
              askKind === "ASK_REQUESTED"
                ? styles.askAnnouncementRequestedCard
                : askKind === "ASK_NO"
                  ? styles.askAnnouncementNoCard
                  : askKind === "ASK_GIVE"
                    ? styles.askAnnouncementGiveCard
                    : null;
            const titleToneStyle =
              askKind === "ASK_REQUESTED"
                ? styles.askAnnouncementRequestedTitle
                : askKind === "ASK_NO"
                  ? styles.askAnnouncementNoTitle
                  : askKind === "ASK_GIVE"
                    ? styles.askAnnouncementGiveTitle
                    : null;
            const titleText =
              askKind === "ASK_REQUESTED"
                ? "Ask Request"
                : askKind === "ASK_NO"
                  ? "Ask Response: No"
                  : askKind === "ASK_GIVE"
                    ? "Ask Response: Give"
                    : "Ask Update";
            return (
          <View
            style={[
              styles.askAnnouncementCard,
              cardToneStyle,
            ]}
          >
            <Text
              style={[
                styles.askAnnouncementTitle,
                titleToneStyle,
              ]}
            >
              {titleText}
            </Text>
            {askAnnouncementPopup ? (
              <View style={styles.askAnnouncementBody}>
                <View style={styles.askAnnouncementLine}>
                  <Text style={styles.askAnnouncementTextStrong}>{formatDisplayName(askAnnouncementPopup.actorName)}</Text>
                  <Text style={styles.askAnnouncementText}>
                    {askAnnouncementPopup.kind === "ASK_REQUESTED"
                      ? " asked for"
                      : askAnnouncementPopup.kind === "ASK_GIVE"
                        ? " gave"
                        : " said no for"}
                  </Text>
                </View>
                <View style={styles.askAnnouncementCardInlineWrap}>
                  <CardView
                    card={askAnnouncementPopup.card}
                    faceUp
                    selected={false}
                    playable={false}
                    width={54}
                    height={80}
                  />
                </View>
                <View style={styles.askAnnouncementLine}>
                  <Text style={styles.askAnnouncementText}>
                    {askAnnouncementPopup.kind === "ASK_REQUESTED"
                      ? `from ${formatDisplayName(askAnnouncementPopup.targetName)}`
                      : `to ${formatDisplayName(askAnnouncementPopup.targetName)}`}
                  </Text>
                </View>
              </View>
            ) : null}
            <Pressable
              style={styles.declarationDismissButton}
              onPress={() => {
                markPopupRecentlyClosed();
                setAskPanelEnabled(false);
                closeAllPanels();
                setAskAnnouncementPopup(null);
                if (askAnnouncementTimerRef.current) {
                  clearTimeout(askAnnouncementTimerRef.current);
                  askAnnouncementTimerRef.current = null;
                }
                lockPanels();
                reEnableAskPanelWithDelay();
              }}
            >
              <Text style={styles.declarationDismissText}>Close</Text>
            </Pressable>
          </View>
            );
          })()}
        </View>
      </Modal>

      <Modal
        visible={
          !!lastAskResult &&
          !!lastAskResult.askingPlayerName &&
          !!lastAskResult.targetPlayerName &&
          !!lastAskResult.card &&
          !modalLocked
        }
        transparent
        animationType="fade"
      >
        <View style={styles.askResultOverlay}>
          <View
            style={[
              styles.askResultCard,
              { borderColor: lastAskResult?.targetHadCard ? "#22c55e" : "#ef4444" },
            ]}
          >
            <Text style={styles.askResultIcon}>{lastAskResult?.targetHadCard ? "✅" : "❌"}</Text>
            <Text style={styles.askResultMeta}>
              {formatDisplayName(lastAskResult?.askingPlayerName)} asked {formatDisplayName(lastAskResult?.targetPlayerName)}
            </Text>
            {lastAskResult?.card ? <CardDisplay card={lastAskResult.card} size="large" /> : null}
            <Text
              style={[
                styles.askResultTitle,
                { color: lastAskResult?.targetHadCard ? "#22c55e" : "#ef4444" },
              ]}
            >
              {lastAskResult?.targetHadCard
                ? `${formatDisplayName(lastAskResult.targetPlayerName)} gave it!`
                : `${formatDisplayName(lastAskResult?.targetPlayerName)} said No!`}
            </Text>
            <Text style={styles.askResultCardName}>{lastAskResult?.cardName}</Text>
            <Text style={styles.askResultTurnInfo}>
              {lastAskResult?.targetHadCard
                ? `${formatDisplayName(lastAskResult.askingPlayerName)} plays again`
                : `Turn passes to ${formatDisplayName(lastAskResult?.targetPlayerName)}`}
            </Text>
            <Pressable style={styles.askResultButton} onPress={closeModal}>
              <Text style={styles.askResultButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!lastDeclareResult && !!lastDeclareResult.halfSuit && !!lastDeclareResult.winningTeam && !modalLocked}
        transparent
        animationType="fade"
      >
        <View style={styles.askResultOverlay}>
          <View
            style={[
              styles.askResultCard,
              { borderColor: lastDeclareResult?.correct ? "#22c55e" : "#ef4444" },
            ]}
          >
            <Text style={styles.askResultIcon}>{lastDeclareResult?.correct ? "📚" : "💥"}</Text>
            <Text
              style={[
                styles.declareResultTitle,
                { color: lastDeclareResult?.correct ? "#22c55e" : "#ef4444" },
              ]}
            >
              {lastDeclareResult?.correct ? "✅ Correct Declaration!" : "❌ Wrong Declaration!"}
            </Text>
            <Text style={styles.askResultMeta}>
              {formatDisplayName(lastDeclareResult?.declaringPlayerName)} declared {lastDeclareResult?.halfSuit?.replace("_", " ")}
            </Text>
            <View style={styles.declareCardsWrap}>
              {getHalfSuitCards(lastDeclareResult?.halfSuit as HalfSuit).map((card) => (
                <CardDisplay key={cardToCode(card)} card={card} size="small" />
              ))}
            </View>
            <View style={styles.declareBookWrap}>
              <Text style={styles.declareBookLabel}>Score awarded to</Text>
              <Text
                style={[
                  styles.declareBookTeam,
                  { color: lastDeclareResult?.winningTeam === "TEAM_A" ? "#3b82f6" : "#ef4444" },
                ]}
              >
                {lastDeclareResult?.winningTeam === "TEAM_A" ? "Team A" : "Team B"}
              </Text>
            </View>
            {lastDeclareResult?.ranOutOfCards ? (
              <Text style={styles.declareWarningText}>
                Player ran out of cards — turn passes to their teammate
              </Text>
            ) : null}
            <Pressable style={styles.askResultButton} onPress={closeModal}>
              <Text style={styles.askResultButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(gameOverData)} transparent animationType="fade" onRequestClose={handleGameOverClose}>
        <View style={styles.gameOverOverlay}>
          <View
            style={[
              styles.gameOverCard,
              {
                borderColor:
                  gameOverData?.winner === "DRAW"
                    ? "#f59e0b"
                    : gameOverData?.winner === myPlayer?.team
                      ? "#22c55e"
                      : "#ef4444",
              },
            ]}
          >
            <Text style={styles.gameOverIcon}>
              {gameOverData?.winner === "DRAW" ? "🤝" : gameOverData?.winner === myPlayer?.team ? "🏆" : "😔"}
            </Text>
            <Text
              style={[
                styles.gameOverTitle,
                {
                  color:
                    gameOverData?.winner === "DRAW"
                      ? "#f59e0b"
                      : gameOverData?.winner === myPlayer?.team
                        ? "#22c55e"
                        : "#ef4444",
                },
              ]}
            >
              {gameOverData?.winner === "DRAW"
                ? "IT'S A DRAW! 🤝"
                : gameOverData?.winner === myPlayer?.team
                  ? "YOUR TEAM WINS!"
                  : "YOU LOST"}
            </Text>
            <Text style={styles.gameOverSubTitle}>
              {gameOverData?.winner === "DRAW"
                ? "Both teams finished with equal scores"
                : `${gameOverData?.winner === "TEAM_A" ? "Team A" : "Team B"} wins the game`}
            </Text>
            <Text style={styles.gameOverStatusText}>
              Status: {gameOverData?.gameStatus ?? "FINISHED"}
            </Text>
            <View style={styles.gameOverScoreRow}>
              <View style={styles.gameOverScoreItem}>
                <Text style={styles.gameOverScoreA}>{gameOverData?.teamABooks ?? 0}</Text>
                <Text style={styles.gameOverScoreLabel}>Team A Score</Text>
              </View>
              <View style={styles.gameOverVsWrap}>
                <Text style={styles.gameOverVs}>vs</Text>
              </View>
              <View style={styles.gameOverScoreItem}>
                <Text style={styles.gameOverScoreB}>{gameOverData?.teamBBooks ?? 0}</Text>
                <Text style={styles.gameOverScoreLabel}>Team B Score</Text>
              </View>
            </View>
            <Text style={styles.gameOverCountdown}>Returning to home in {countdown}s...</Text>
          </View>
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
  scoreTimerWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 4,
  },
  scoreTimerIcon: {
    color: "#f59e0b",
    fontSize: 12,
  },
  scoreTimerText: {
    color: "#f8fafc",
    fontWeight: "800",
    fontSize: 11,
    minWidth: 30,
  },
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
  playerCoins: { color: "#fbbf24", fontWeight: "800", fontSize: 10 },
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
  askTimerSection: {
    marginTop: 2,
    alignItems: "center",
    gap: 6,
  },
  turnActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timeWarning: {
    color: "#ef4444",
    fontWeight: "900",
    fontSize: 12,
    textAlign: "center",
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
  declarePanel: {
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 8,
    height: "96%",
    maxHeight: "96%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1e293b",
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 10,
    overflow: "visible",
  },
  declareHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
    paddingLeft: 6,
    paddingRight: 8,
    marginBottom: 2,
  },
  declareContentInset: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  declareGroupsListContent: {
    gap: 8,
    paddingBottom: 10,
    paddingHorizontal: 2,
    overflow: "visible",
  },
  declareGroupWrap: {
    width: "100%",
    minHeight: 0,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "rgba(15,23,42,0.7)",
    overflow: "visible",
  },
  declareGroupWrapActive: {
    borderColor: "#f59e0b",
    backgroundColor: "rgba(245,158,11,0.12)",
  },
  declareGroupColumn: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  declareGroupCardVertical: {
    overflow: "visible",
  },
  askOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
  },
  askBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
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
  askActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
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
  declareSetButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#f59e0b",
    backgroundColor: "#0f172a",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  declareSetText: {
    color: "#f59e0b",
    fontWeight: "800",
    fontSize: 13,
  },
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
  declarationOverlay: {
    flex: 1,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  declarationGlowLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  declarationGlowSuccess: {
    backgroundColor: "transparent",
  },
  declarationGlowFail: {
    backgroundColor: "transparent",
  },
  declarationCard: {
    width: "100%",
    maxWidth: 430,
    maxHeight: "78%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1e293b",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  declarationAlertCard: {
    borderColor: "#f59e0b",
    backgroundColor: "#1e293b",
  },
  declarationTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "800",
  },
  declarationAlertTitle: {
    color: "#fbbf24",
  },
  declarationAlertSubTitle: {
    color: "#e2e8f0",
    fontWeight: "700",
    fontSize: 13,
    marginTop: -2,
  },
  declarationScrollContent: {
    paddingBottom: 8,
    gap: 10,
  },
  declarationHolderBlock: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0f172a",
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 8,
  },
  declarationHolderName: {
    color: "#cbd5e1",
    fontWeight: "700",
    fontSize: 12,
  },
  declarationCardsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    overflow: "visible",
    paddingTop: 6,
    minHeight: 92,
  },
  declarationCardWrap: {
    overflow: "hidden",
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  declarationDismissButton: {
    alignSelf: "flex-end",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#f59e0b",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#7c2d12",
  },
  declarationDismissText: {
    color: "#f8fafc",
    fontWeight: "800",
    fontSize: 12,
  },
  resultSuccess: {
    borderColor: "#22c55e",
  },
  resultFail: {
    borderColor: "#ef4444",
  },
  resultText: {
    color: "#e2e8f0",
    fontWeight: "700",
    fontSize: 13,
  },
  askAnnouncementOverlay: {
    flex: 1,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  askAnnouncementCard: {
    width: "100%",
    maxWidth: 430,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1e293b",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  askAnnouncementRequestedCard: {
    borderColor: "#3b82f6",
    backgroundColor: "#1e3a8a",
  },
  askAnnouncementNoCard: {
    borderColor: "#ef4444",
    backgroundColor: "#7f1d1d",
  },
  askAnnouncementGiveCard: {
    borderColor: "#22c55e",
    backgroundColor: "#14532d",
  },
  askAnnouncementTitle: {
    color: "#f8fafc",
    fontWeight: "800",
    fontSize: 16,
  },
  askAnnouncementRequestedTitle: {
    color: "#93c5fd",
  },
  askAnnouncementNoTitle: {
    color: "#fca5a5",
  },
  askAnnouncementGiveTitle: {
    color: "#86efac",
  },
  askAnnouncementText: {
    color: "#e2e8f0",
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 19,
  },
  askAnnouncementBody: {
    gap: 8,
    alignItems: "center",
  },
  askAnnouncementLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  askAnnouncementTextStrong: {
    color: "#f8fafc",
    fontWeight: "900",
    fontSize: 14,
  },
  askAnnouncementCardInlineWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  askResultOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  askResultCard: {
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    borderWidth: 2,
  },
  askResultIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  askResultMeta: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 16,
    textAlign: "center",
  },
  askResultTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  askResultCardName: {
    fontSize: 14,
    color: "#cbd5e1",
    marginBottom: 20,
  },
  askResultTurnInfo: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 20,
    textAlign: "center",
  },
  askResultButton: {
    backgroundColor: "#f59e0b",
    borderRadius: 10,
    paddingHorizontal: 32,
    paddingVertical: 10,
    width: "100%",
    alignItems: "center",
  },
  askResultButtonText: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 15,
  },
  declareResultTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  declareCardsWrap: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  declareBookWrap: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
  },
  declareBookLabel: {
    color: "#94a3b8",
    fontSize: 12,
  },
  declareBookTeam: {
    fontWeight: "700",
    fontSize: 16,
    marginTop: 4,
  },
  declareWarningText: {
    color: "#f59e0b",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 12,
  },
  gameOverOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  gameOverCard: {
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 32,
    width: "100%",
    alignItems: "center",
    borderWidth: 2,
  },
  gameOverIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  gameOverTitle: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
  },
  gameOverSubTitle: {
    fontSize: 16,
    color: "#94a3b8",
    marginBottom: 24,
  },
  gameOverStatusText: {
    fontSize: 12,
    color: "#cbd5e1",
    marginBottom: 12,
    fontWeight: "700",
  },
  gameOverScoreRow: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 32,
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    justifyContent: "center",
  },
  gameOverScoreItem: {
    alignItems: "center",
  },
  gameOverScoreA: {
    color: "#3b82f6",
    fontSize: 36,
    fontWeight: "800",
  },
  gameOverScoreB: {
    color: "#ef4444",
    fontSize: 36,
    fontWeight: "800",
  },
  gameOverScoreLabel: {
    color: "#94a3b8",
    fontSize: 12,
  },
  gameOverVsWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  gameOverVs: {
    color: "#f59e0b",
    fontSize: 20,
  },
  gameOverCountdown: {
    color: "#64748b",
    fontSize: 13,
  },
});
