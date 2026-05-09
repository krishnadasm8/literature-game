import { useEffect } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";

import type { Card, GameState } from "@shared/src";

import { useGameStore } from "../store/gameStore";
import { socketService } from "../services/socket";

export const useGameState = (): void => {
  const router = useRouter();
  const setGameState = useGameStore((state) => state.setGameState);
  const setMyHand = useGameStore((state) => state.setMyHand);

  useEffect(() => {
    const socket = socketService.connect();

    const offStateUpdate = socketService.on<{ gameState: GameState; myHand?: Card[] }>(
      "game:state_update",
      (payload) => {
        setGameState(payload.gameState);
        if (payload.myHand) {
          setMyHand(payload.myHand);
        }
      },
    );

    const offTurnChanged = socketService.on<{ currentTurnPlayerName: string }>(
      "game:turn_changed",
      async (payload) => {
        if (AppState.currentState !== "active") {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Your turn is changing",
              body: `Now playing: ${payload.currentTurnPlayerName}`,
            },
            trigger: null,
          });
        }
      },
    );

    const offGameOver = socketService.on<{ roomCode: string }>("game:over", (payload) => {
      const roomCode = payload.roomCode;
      if (roomCode) {
        router.push(`/game/${roomCode}/result`);
      }
    });

    return () => {
      offStateUpdate();
      offTurnChanged();
      offGameOver();
      socket.disconnect();
    };
  }, [router, setGameState, setMyHand]);
};
