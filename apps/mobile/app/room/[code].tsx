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
  useWindowDimensions,
  View,
} from "react-native";

import { Team, type GameState } from "@shared/src";

import { Avatar } from "../../components/ui/Avatar";
import { getRoom, joinRoom, setReady, startGame } from "../../services/roomService";
import { socketService } from "../../services/socket";
import { useAuthStore } from "../../store/authStore";
import { useGameStore } from "../../store/gameStore";
import { useRoomStore } from "../../store/roomStore";

export default function RoomCodeScreen(): JSX.Element {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const normalizedCode = (code ?? "").toUpperCase();
  const user = useAuthStore((state) => state.user);
  const room = useRoomStore((state) => state.room);
  const players = useRoomStore((state) => state.players);
  const setRoom = useRoomStore((state) => state.setRoom);
  const setGameState = useGameStore((state) => state.setGameState);
  const setMyHand = useGameStore((state) => state.setMyHand);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const { width, height } = useWindowDimensions();
  const isCompact = width <= 390 || height <= 844;
  const avatarSize = isCompact ? 34 : 42;
  const joinedAnim = useMemo(() => new Animated.Value(0), []);
  const listPulseStyle = {
    transform: [
      {
        translateX: joinedAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [32, 0],
        }),
      },
    ],
    opacity: joinedAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.35, 1],
    }),
  };

  const myPlayer = players.find((player) => player.id === user?.id);
  const isHost = room?.hostId === user?.id;
  const allPlayersReady = players.length > 0 && players.every((player) => player.isReady);
  const canStart = isHost && players.length >= 4 && allPlayersReady;
  const teamAPlayers = players.filter((player) => player.team === Team.TEAM_A);
  const teamBPlayers = players.filter((player) => player.team === Team.TEAM_B);

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
        joinedAnim.setValue(0);
        Animated.sequence([
          Animated.timing(joinedAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
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

    const offPlayerReady = socketService.on<{ playerId: string; isReady: boolean }>(
      "room:player_ready",
      async () => {
        await refreshRoom();
      },
      "/room",
    );

    const offGameStarting = socketService.on<{ roomCode: string; gameState?: GameState }>(
      "room:game_starting",
      (payload) => {
        if (payload.roomCode?.toUpperCase() === normalizedCode) {
          if (payload.gameState) {
            setGameState(payload.gameState);
            setMyHand([]);
          }
          router.replace(`/game/${normalizedCode}`);
        }
      },
      "/room",
    );

    void init();

    return () => {
      mounted = false;
      offPlayerJoined();
      offPlayerLeft();
      offPlayerReady();
      offGameStarting();
      socket.disconnect();
    };
  }, [joinedAnim, normalizedCode, router, setGameState, setMyHand, setRoom]);

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
      <View style={[styles.header, isCompact && styles.headerCompact]}>
        <Text style={[styles.title, isCompact && styles.titleCompact]}>Room Lobby</Text>
        <Text style={[styles.roomCode, isCompact && styles.roomCodeCompact]}>{normalizedCode || "-"}</Text>
        <View style={styles.codeActions}>
          <Pressable style={styles.codeActionButton} onPress={() => void onCopyCode()}>
            <Text style={styles.codeActionText}>Copy</Text>
          </Pressable>
          <Pressable style={styles.codeActionButton} onPress={() => void onShare()}>
            <Text style={styles.codeActionText}>Share</Text>
          </Pressable>
        </View>
        <Text style={styles.countText}>
          {players.length} / {room?.maxPlayers ?? 6} players
        </Text>
      </View>

      <Animated.View style={[styles.playerListContainer, listPulseStyle]}>
        <View style={[styles.columns, isCompact && styles.columnsCompact]}>
          <View style={[styles.teamColumn, isCompact && styles.teamColumnCompact]}>
            <Text style={[styles.teamTitle, styles.teamATitle]}>Team A</Text>
            <ScrollView contentContainerStyle={styles.teamList} showsVerticalScrollIndicator={false}>
              {teamAPlayers.map((player) => (
                <View key={player.id} style={[styles.playerCard, styles.playerCardA, isCompact && styles.playerCardCompact]}>
                  <Avatar displayName={player.displayName} avatarUrl={player.avatarUrl ?? undefined} size={avatarSize} />
                  <Text style={styles.playerName} numberOfLines={1}>
                    {player.displayName}
                  </Text>
                  {player.isReady ? (
                    <Text style={styles.readyBadge}>✓ Ready</Text>
                  ) : (
                    <Text style={styles.notReadyBadge}>Not ready</Text>
                  )}
                  {player.isBot ? <Text style={styles.botBadge}>Bot</Text> : null}
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={[styles.teamColumn, isCompact && styles.teamColumnCompact]}>
            <Text style={[styles.teamTitle, styles.teamBTitle]}>Team B</Text>
            <ScrollView contentContainerStyle={styles.teamList} showsVerticalScrollIndicator={false}>
              {teamBPlayers.map((player) => (
                <View key={player.id} style={[styles.playerCard, styles.playerCardB, isCompact && styles.playerCardCompact]}>
                  <Avatar displayName={player.displayName} avatarUrl={player.avatarUrl ?? undefined} size={avatarSize} />
                  <Text style={styles.playerName} numberOfLines={1}>
                    {player.displayName}
                  </Text>
                  {player.isReady ? (
                    <Text style={styles.readyBadge}>✓ Ready</Text>
                  ) : (
                    <Text style={styles.notReadyBadge}>Not ready</Text>
                  )}
                  {player.isBot ? <Text style={styles.botBadge}>Bot</Text> : null}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Animated.View>

      {isHost ? (
        <Pressable
          disabled={!canStart || updating}
          style={[styles.startButton, (!canStart || updating) && styles.disabledButton]}
          onPress={() => void onStartGame()}
        >
          <Text style={styles.startButtonText}>{updating ? "Starting..." : "Start Game"}</Text>
        </Pressable>
      ) : (
        <Pressable
          disabled={updating}
          style={[styles.readyButton, updating && styles.disabledButton]}
          onPress={() => void onToggleReady()}
        >
          <Text style={styles.readyButtonText}>{myPlayer?.isReady ? "Unready" : "Ready"}</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
    gap: 10,
    backgroundColor: "#0f172a",
  },
  header: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: "rgba(15,23,42,0.92)",
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    gap: 8,
  },
  headerCompact: {
    padding: 10,
    gap: 6,
  },
  title: {
    color: "#f8fafc",
    fontWeight: "700",
    fontSize: 20,
  },
  titleCompact: {
    fontSize: 18,
  },
  roomCode: {
    fontSize: 34,
    letterSpacing: 3,
    fontWeight: "800",
    color: "#f8fafc",
  },
  roomCodeCompact: {
    fontSize: 30,
    letterSpacing: 2,
  },
  codeActions: {
    flexDirection: "row",
    gap: 8,
  },
  codeActionButton: {
    borderWidth: 1,
    borderColor: "#475569",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#1e293b",
  },
  codeActionText: {
    color: "#e2e8f0",
    fontWeight: "600",
  },
  countText: {
    fontWeight: "800",
    fontSize: 15,
    color: "#f8fafc",
  },
  playerListContainer: {
    flex: 1,
    minHeight: 0,
  },
  columns: {
    flexDirection: "row",
    gap: 10,
    flex: 1,
  },
  columnsCompact: {
    gap: 8,
  },
  teamColumn: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    backgroundColor: "rgba(15,23,42,0.7)",
    borderWidth: 1,
    borderColor: "#334155",
    minHeight: 0,
  },
  teamColumnCompact: {
    padding: 8,
  },
  teamTitle: {
    textAlign: "center",
    fontWeight: "800",
    marginBottom: 8,
    fontSize: 13,
  },
  teamATitle: {
    color: "#3b82f6",
  },
  teamBTitle: {
    color: "#ef4444",
  },
  teamList: {
    gap: 8,
  },
  playerCard: {
    borderRadius: 12,
    padding: 8,
    gap: 6,
    alignItems: "center",
    borderWidth: 1,
  },
  playerCardCompact: {
    padding: 6,
    gap: 4,
  },
  playerCardA: {
    borderColor: "#3b82f6",
    backgroundColor: "rgba(59,130,246,0.14)",
  },
  playerCardB: {
    borderColor: "#ef4444",
    backgroundColor: "rgba(239,68,68,0.14)",
  },
  playerName: {
    color: "#f8fafc",
    fontWeight: "600",
    fontSize: 12,
    textAlign: "center",
  },
  readyBadge: {
    color: "#22c55e",
    fontWeight: "700",
    fontSize: 11,
  },
  notReadyBadge: {
    color: "#94a3b8",
    fontWeight: "600",
    fontSize: 11,
  },
  botBadge: {
    color: "#f59e0b",
    fontWeight: "700",
    fontSize: 11,
  },
  readyButton: {
    borderRadius: 12,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  readyButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  startButton: {
    borderRadius: 10,
    backgroundColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    shadowColor: "#f59e0b",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  startButtonText: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
