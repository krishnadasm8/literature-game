import { router } from "expo-router";
import { Alert, Platform } from "react-native";

import { leaveRoom } from "../services/roomService";
import { socketService } from "../services/socket";
import { useGameStore } from "../store/gameStore";

const LEAVE_MESSAGE = "Are you sure you want to leave? Your team may forfeit.";

async function runLeaveGameSession(roomCode: string): Promise<void> {
  const code = roomCode.trim().toUpperCase();
  if (!code) {
    router.replace("/(tabs)/lobby");
    return;
  }

  try {
    await leaveRoom(code);
  } catch {
    // Still leave the screen; user may already be removed or offline.
  }

  socketService.emit("game:leave", { roomCode: code });
  socketService.disconnect("/game");
  useGameStore.getState().clearGame();
  router.replace("/(tabs)/lobby");
}

/**
 * Confirms then leaves the active game: HTTP leave, socket leave, clear local game state, go to Lobby.
 */
export function confirmLeaveGame(roomCode: string): void {
  const run = (): void => {
    void runLeaveGameSession(roomCode);
  };

  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`Leave Game?\n\n${LEAVE_MESSAGE}`)) {
      run();
    }
    return;
  }

  Alert.alert("Leave Game?", LEAVE_MESSAGE, [
    { text: "Stay", style: "cancel" },
    { text: "Leave", style: "destructive", onPress: run },
  ]);
}
