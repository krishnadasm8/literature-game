import { useEffect, useRef } from "react";
import { Alert, AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";

import type { Card, GameState } from "@shared/src";

import { useGameStore } from "../store/gameStore";
import { getGameState } from "../services/gameService";
import { playSfx } from "../services/soundEffects";
import { socketService } from "../services/socket";
import { useAuthStore } from "../store/authStore";

export const useGameState = (roomCode?: string): void => {
  const setGameState = useGameStore((state) => state.setGameState);
  const setMyHand = useGameStore((state) => state.setMyHand);
  const setLastAskResult = useGameStore((state) => state.setLastAskResult);
  const setLastDeclareResult = useGameStore((state) => state.setLastDeclareResult);
  const setGameOver = useGameStore((state) => state.setGameOver);
  const mergePlayerCoins = useGameStore((state) => state.mergePlayerCoins);
  const updateUserStats = useAuthStore((state) => state.updateUserStats);
  const userId = useAuthStore((state) => state.user?.id);
  const askResultShownRef = useRef(false);
  const askResultKeyRef = useRef<string | null>(null);
  const lastAskResultAtRef = useRef(0);
  const handDealtSfxRef = useRef(false);

  useEffect(() => {
    const loadInitialState = async () => {
      if (!roomCode) return;
      try {
        const room = await getGameState(roomCode);
        if (room?.gameState) {
          useGameStore.getState().setGameState(room.gameState);
        }
        if (room?.myHand) {
          useGameStore.getState().setMyHand(room.myHand);
        }
      } catch (e) {
        console.log("Failed to load initial game state:", e);
      }
    };
    void loadInitialState();
  }, [roomCode]);

  useEffect(() => {
    handDealtSfxRef.current = false;
  }, [roomCode]);

  useEffect(() => {
    const socket = socketService.connect();
    if (roomCode) {
      socketService.emit("game:join", { roomCode });
    }

    const offStateUpdate = socketService.on<{ gameState: GameState; myHand?: Card[] }>(
      "game:state_update",
      (data) => {
        console.log("game:state_update received:", data);
        if (data.gameState) {
          useGameStore.getState().setGameState(data.gameState);
        }
        if (data.myHand) {
          useGameStore.getState().setMyHand(data.myHand);
        }
      },
    );

    const offTurnChanged = socketService.on<{ currentTurnPlayerName: string }>(
      "game:turn_changed",
      async (payload) => {
        playSfx("turn");
        const canScheduleNativeNotification =
          Platform.OS !== "web" && typeof Notifications.scheduleNotificationAsync === "function";

        if (AppState.currentState !== "active" && canScheduleNativeNotification) {
          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "Your turn is changing",
                body: `Now playing: ${payload.currentTurnPlayerName}`,
              },
              trigger: null,
            });
          } catch {
            // Best-effort notifications; ignore unsupported runtime failures.
          }
        }
      },
    );

    const offHandUpdate = socketService.on<{ hand: Card[] }>("game:hand_update", (data) => {
      if ((data.hand?.length ?? 0) > 0 && !handDealtSfxRef.current) {
        handDealtSfxRef.current = true;
        playSfx("deal");
      }
      useGameStore.getState().setMyHand(data.hand);
    });

    const offAskResolved = socketService.on<{
      success: boolean;
      targetHadCard: boolean;
      card: Card;
      cardName: string;
      askingPlayerId: string;
      targetPlayerName: string;
      targetPlayerId: string;
      askingPlayerName: string;
      nextTurnPlayerId: string;
    }>("game:ask_resolved", (data) => {
      if (useGameStore.getState().modalLocked) {
        console.log("ask_resolved blocked by modal lock");
        return;
      }
      if (
        !data?.askingPlayerId ||
        !data?.targetPlayerId ||
        !data?.askingPlayerName ||
        !data?.targetPlayerName ||
        !data?.card ||
        !data?.card.rank ||
        !data?.card.suit
      ) {
        return;
      }
      if (data.askingPlayerName === "Player" && data.targetPlayerName === "Player") {
        return;
      }
      const askKey = `${data.askingPlayerId}:${data.targetPlayerId}:${data.card.rank}:${data.card.suit}`;
      const now = Date.now();
      if (askResultKeyRef.current === askKey && now - lastAskResultAtRef.current < 12000) {
        return;
      }
      if (askResultShownRef.current) {
        return;
      }
      askResultShownRef.current = true;
      askResultKeyRef.current = askKey;
      lastAskResultAtRef.current = now;
      playSfx(data.success ? "askHit" : "askMiss");
      setLastAskResult({
        ...data,
        isForMe: data.askingPlayerId === userId || data.targetPlayerId === userId,
      });
      setTimeout(() => {
        askResultShownRef.current = false;
      }, 5000);
    });

    const offDeclareResult = socketService.on<{
      correct: boolean;
      halfSuit: string;
      winningTeam: string;
      declaringPlayerId: string;
      declaringPlayerName: string;
      ranOutOfCards: boolean;
      nextTurnPlayerId: string;
    }>("game:declare_result", (data) => {
      if (useGameStore.getState().modalLocked) {
        console.log("declare_result blocked by modal lock");
        return;
      }
      playSfx(data.correct ? "declareWin" : "declareLose");
      setLastDeclareResult(data);
    });

    const offCoinsUpdate = socketService.on<{ coinsByPlayerId: Record<string, number> }>(
      "game:coins_update",
      (data) => {
        if (!data?.coinsByPlayerId) {
          return;
        }
        mergePlayerCoins(data.coinsByPlayerId);
        if (userId && typeof data.coinsByPlayerId[userId] === "number") {
          updateUserStats({ coins: data.coinsByPlayerId[userId] });
        }
      },
    );

    const offGameOver = socketService.on<{
      winner: string;
      teamABooks: number;
      teamBBooks: number;
      scores: Record<string, number>;
      gameStatus?: string;
      playerStats?: Record<string, { gamesPlayed: number; gamesWon: number; winRate: number; coins: number }>;
    }>("game:over", (data) => {
      const gs = useGameStore.getState().gameState;
      const me = userId ? gs?.players.find((p) => p.id === userId) : undefined;
      if (data.winner === "DRAW") {
        playSfx("confirm");
      } else if (me && (data.winner === "TEAM_A" || data.winner === "TEAM_B") && data.winner === me.team) {
        playSfx("victory");
      } else {
        playSfx("defeat");
      }
      if (userId && data.playerStats?.[userId]) {
        updateUserStats(data.playerStats[userId]);
      }
      setGameOver(data);
    });

    const offGameError = socketService.on<{ message: string }>("game:error", (data) => {
      console.error("SOCKET game:error received:", data.message);
      playSfx("error");
      Alert.alert("Game Error", data.message);
    });

    return () => {
      if (roomCode) {
        socketService.emit("game:leave", { roomCode });
      }
      offStateUpdate();
      offTurnChanged();
      offHandUpdate();
      offAskResolved();
      offDeclareResult();
      offCoinsUpdate();
      offGameOver();
      offGameError();
      socket.disconnect();
    };
  }, [roomCode, setGameState, setMyHand, setGameOver, setLastAskResult, setLastDeclareResult, updateUserStats, userId, mergePlayerCoins]);
};
