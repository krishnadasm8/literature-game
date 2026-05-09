import { useEffect } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";

import type { Card, GameState } from "@shared/src";

import { useGameStore } from "../store/gameStore";
import { getGameState } from "../services/gameService";
import { socketService } from "../services/socket";

export const useGameState = (roomCode?: string): void => {
  const router = useRouter();
  const setGameState = useGameStore((state) => state.setGameState);
  const setMyHand = useGameStore((state) => state.setMyHand);

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

    const offAskResolved = socketService.on("game:ask_resolved", async () => {
      if (!roomCode) {
        return;
      }
      try {
        const room = await getGameState(roomCode);
        if (room?.gameState) {
          useGameStore.getState().setGameState(room.gameState);
        }
        if (room?.myHand) {
          useGameStore.getState().setMyHand(room.myHand);
        }
      } catch {
        // Best-effort refresh on ask resolve.
      }
    });

    return () => {
      if (roomCode) {
        socketService.emit("game:leave", { roomCode });
      }
      offStateUpdate();
      offTurnChanged();
      offGameOver();
      offAskResolved();
      socket.disconnect();
    };
  }, [roomCode, router, setGameState, setMyHand]);
};
