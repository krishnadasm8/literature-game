import React, { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import {
  Alert,
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Team } from "@shared/src";

import { PlayerSlot } from "../../components/room/PlayerSlot";
import { getRoom, joinRoom, setReady, startGame } from "../../services/roomService";
import { socketService } from "../../services/socket";
import { useAuthStore } from "../../store/authStore";
import { useRoomStore } from "../../store/roomStore";

export default function RoomCodeScreen(): JSX.Element {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const normalizedCode = (code ?? "").toUpperCase();
  const user = useAuthStore((state) => state.user);
  const room = useRoomStore((state) => state.room);
  const players = useRoomStore((state) => state.players);
  const setRoom = useRoomStore((state) => state.setRoom);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const joinedAnim = useMemo(() => new Animated.Value(0), []);
  const listPulseStyle = {
    transform: [
      {
        scale: joinedAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.02],
        }),
      },
    ],
  };

  const myPlayer = players.find((player) => player.id === user?.id);
  const isHost = room?.hostId === user?.id;
  const canStart = isHost && players.length >= 4;

  useEffect(() => {
    let mounted = true;
    const socket = socketService.connect("/room");

    const init = async (): Promise<void> => {
      if (!normalizedCode) {
        setLoading(false);
        return;
      }

      try {
        const response = await joinRoom(normalizedCode);
        if (!mounted) {
          return;
        }
        setRoom(response.room, response.room.players);
        socketService.emit("room:join", { roomCode: normalizedCode }, "/room");
      } catch (error) {
        Alert.alert("Room Error", error instanceof Error ? error.message : "Failed to join room.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const refreshRoom = async (): Promise<void> => {
      if (!normalizedCode) {
        return;
      }
      const refreshed = await getRoom(normalizedCode);
      setRoom(refreshed.room, refreshed.room.players);
    };

    const offPlayerJoined = socketService.on<{ playerId: string }>(
      "room:player_joined",
      async () => {
        Animated.sequence([
          Animated.timing(joinedAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
          Animated.timing(joinedAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
        ]).start();
        await refreshRoom();
      },
      "/room",
    );

    const offPlayerLeft = socketService.on<{ playerId: string }>(
      "room:player_left",
      async () => {
        await refreshRoom();
      },
      "/room",
    );

    const offGameStarting = socketService.on<{ roomCode: string }>(
      "room:game_starting",
      (payload) => {
        if (payload.roomCode?.toUpperCase() === normalizedCode) {
          router.replace(`/game/${normalizedCode}`);
        }
      },
      "/room",
    );

    void init();

    return () => {
      mounted = false;
      socketService.emit("room:leave", { roomCode: normalizedCode }, "/room");
      offPlayerJoined();
      offPlayerLeft();
      offGameStarting();
      socket.disconnect();
    };
  }, [joinedAnim, normalizedCode, router, setRoom]);

  const onToggleReady = async (): Promise<void> => {
    if (!room || !myPlayer) {
      return;
    }
    setUpdating(true);
    try {
      const response = await setReady(room.roomCode, !myPlayer.isReady);
      setRoom(response.room, response.room.players);
    } catch (error) {
      Alert.alert("Ready Error", error instanceof Error ? error.message : "Could not update readiness.");
    } finally {
      setUpdating(false);
    }
  };

  const onStartGame = async (): Promise<void> => {
    if (!room) {
      return;
    }
    setUpdating(true);
    try {
      const response = await startGame(room.roomCode);
      setRoom(response.room, response.room.players);
    } catch (error) {
      Alert.alert("Start Error", error instanceof Error ? error.message : "Could not start game.");
    } finally {
      setUpdating(false);
    }
  };

  const onCopyCode = async (): Promise<void> => {
    await Clipboard.setStringAsync(normalizedCode);
    Alert.alert("Copied", "Room code copied to clipboard.");
  };

  const onShare = async (): Promise<void> => {
    await Share.share({
      message: `Join my Literature game! Code: ${normalizedCode}`,
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Joining room...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Room Lobby</Text>
      <View style={styles.codeRow}>
        <Text style={styles.subtitle}>Room code: {normalizedCode || "-"}</Text>
        <Pressable style={styles.codeButton} onPress={() => void onCopyCode()}>
          <Text style={styles.codeButtonText}>Copy</Text>
        </Pressable>
        <Pressable style={styles.codeButton} onPress={() => void onShare()}>
          <Text style={styles.codeButtonText}>Share</Text>
        </Pressable>
      </View>

      <Text style={styles.countText}>{players.length}/{room?.maxPlayers ?? 6} players</Text>

      <Animated.View style={listPulseStyle}>
        <ScrollView contentContainerStyle={styles.playersWrap}>
          {players.map((player) => (
            <Animated.View
              key={player.id}
              style={[styles.playerRow, player.team === Team.TEAM_A ? styles.teamA : styles.teamB]}
            >
              <PlayerSlot
                player={
                  {
                    id: player.id,
                    displayName: player.displayName,
                    avatarUrl: player.avatarUrl ?? "",
                    team: player.team,
                    handCount: 0,
                    isBot: player.isBot,
                    isConnected: true,
                  } as any
                }
                showCardCount={false}
              />
              <View style={styles.meta}>
                {player.isBot ? <Text style={styles.badge}>Bot</Text> : null}
                {player.isReady ? <Text style={styles.badge}>Ready</Text> : null}
              </View>
            </Animated.View>
          ))}
        </ScrollView>
      </Animated.View>

      {isHost ? (
        <Pressable
          disabled={!canStart || updating}
          style={[styles.primaryButton, (!canStart || updating) && styles.disabledButton]}
          onPress={() => void onStartGame()}
        >
          <Text style={styles.primaryText}>{updating ? "Starting..." : "Start Game"}</Text>
        </Pressable>
      ) : (
        <Pressable
          disabled={updating}
          style={[styles.primaryButton, updating && styles.disabledButton]}
          onPress={() => void onToggleReady()}
        >
          <Text style={styles.primaryText}>{myPlayer?.isReady ? "Unready" : "Ready"}</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 10,
    backgroundColor: "#f8fafc",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    color: "#4b5563",
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  codeButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  codeButtonText: {
    color: "#374151",
    fontWeight: "600",
  },
  countText: {
    fontWeight: "700",
    color: "#111827",
  },
  playersWrap: {
    gap: 8,
    paddingVertical: 8,
  },
  playerRow: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  teamA: {
    borderColor: "#3b82f6",
    backgroundColor: "#eff6ff",
  },
  teamB: {
    borderColor: "#ef4444",
    backgroundColor: "#fef2f2",
  },
  meta: {
    flexDirection: "row",
    gap: 6,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#111827",
    color: "#ffffff",
    fontSize: 12,
    overflow: "hidden",
  },
  primaryButton: {
    marginTop: "auto",
    borderRadius: 10,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  primaryText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.5,
  },
});
