import React, { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";

import { Team, type GameState } from "@shared/src";

import { getRoom, joinRoom, setReady, startGame, switchTeam } from "../../services/roomService";
import { socketService } from "../../services/socket";
import { useAuthStore } from "../../store/authStore";
import { useGameStore } from "../../store/gameStore";
import { type RoomMember, useRoomStore } from "../../store/roomStore";

const getInitials = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

const TEAM_COLORS = {
  TEAM_A: "#3b82f6",
  TEAM_B: "#ef4444",
} as const;

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

  const myPlayer = players.find((player) => player.id === user?.id);
  const isHost = room?.hostId === user?.id;
  const teamAPlayers = players.filter((player) => player.team === Team.TEAM_A);
  const teamBPlayers = players.filter((player) => player.team === Team.TEAM_B);
  const maxPlayers = room?.maxPlayers ?? 4;
  const perTeamTarget = Math.max(1, maxPlayers / 2);
  const slotsPerTeam = perTeamTarget;
  const teamASlots: Array<RoomMember | null> = [
    ...teamAPlayers,
    ...Array.from({ length: Math.max(0, slotsPerTeam - teamAPlayers.length) }, () => null),
  ];
  const teamBSlots: Array<RoomMember | null> = [
    ...teamBPlayers,
    ...Array.from({ length: Math.max(0, slotsPerTeam - teamBPlayers.length) }, () => null),
  ];

  const hasFullPlayers = players.length === maxPlayers;
  const isBalancedTeams = teamAPlayers.length === teamBPlayers.length;
  const allReady = players.length > 0 && players.every((player) => player.isReady);
  const canStart = Boolean(isHost && hasFullPlayers && isBalancedTeams && allReady);

  const startDisabledReason = useMemo(() => {
    if (!hasFullPlayers) {
      return `Waiting for players... (${players.length}/${maxPlayers})`;
    }
    if (!isBalancedTeams) {
      return "Teams unequal - balance teams to start";
    }
    if (!allReady) {
      return "Waiting for all players to ready up";
    }
    return "";
  }, [allReady, hasFullPlayers, isBalancedTeams, maxPlayers, players.length]);

  useEffect(() => {
    let mounted = true;
    const socket = socketService.connect("/room");

    const refreshRoom = async (): Promise<void> => {
      if (!normalizedCode) {
        return;
      }
      const refreshed = await getRoom(normalizedCode);
      setRoom(refreshed.room, refreshed.room.players);
    };

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

    const offPlayerJoined = socketService.on("room:player_joined", async () => {
      await refreshRoom();
    }, "/room");
    const offPlayerLeft = socketService.on("room:player_left", async () => {
      await refreshRoom();
    }, "/room");
    const offPlayerReady = socketService.on("room:player_ready", async () => {
      await refreshRoom();
    }, "/room");
    const offTeamChanged = socketService.on("room:team_changed", async () => {
      await refreshRoom();
    }, "/room");
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
      offTeamChanged();
      offGameStarting();
      socket.disconnect();
    };
  }, [normalizedCode, router, setGameState, setMyHand, setRoom]);

  const onToggleReady = async (): Promise<void> => {
    if (!room || !myPlayer || isHost) {
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

  const onSwitchTeam = async (player: RoomMember): Promise<void> => {
    if (!room || player.id !== user?.id) {
      return;
    }
    const nextTeam = player.team === Team.TEAM_A ? Team.TEAM_B : Team.TEAM_A;
    setUpdating(true);
    try {
      const response = await switchTeam(room.roomCode, nextTeam);
      setRoom(response.room, response.room.players);
    } catch (error) {
      Alert.alert("Team Error", error instanceof Error ? error.message : "Could not switch team.");
    } finally {
      setUpdating(false);
    }
  };

  const onStartGame = async (): Promise<void> => {
    if (!room || !canStart) {
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
  };

  const onShare = async (): Promise<void> => {
    await Share.share({
      message: `Join my Literature game! Code: ${normalizedCode}`,
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.contentWrap}>
          <Text style={styles.loadingText}>Joining room...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrap}>
          <View style={styles.roomCodeCard}>
            <Text style={styles.roomCodeLabel}>Room Code</Text>
            <Text style={styles.roomCode}>{normalizedCode || "------"}</Text>
            <View style={styles.codeActions}>
              <Pressable style={styles.codeActionButton} onPress={() => void onCopyCode()}>
                <Text style={styles.codeActionText}>Copy</Text>
              </Pressable>
              <Pressable style={styles.codeActionButton} onPress={() => void onShare()}>
                <Text style={styles.codeActionText}>Share</Text>
              </Pressable>
            </View>
            <Text style={styles.playerCount}>{players.length} / {maxPlayers} players joined</Text>
          </View>

          <View style={styles.gridRow}>
            <View style={styles.teamColumn}>
              <Text style={[styles.teamPill, styles.teamAPill]}>Team A ({teamAPlayers.length}/{perTeamTarget})</Text>
              {teamASlots.map((player, index) => (
                <PlayerSlotCard
                  key={player?.id ?? `a-empty-${index}`}
                  player={player}
                  isHost={room?.hostId === player?.id}
                  isCurrentUser={player?.id === user?.id}
                  onSwitchTeam={onSwitchTeam}
                />
              ))}
            </View>
            <View style={styles.teamColumn}>
              <Text style={[styles.teamPill, styles.teamBPill]}>Team B ({teamBPlayers.length}/{perTeamTarget})</Text>
              {teamBSlots.map((player, index) => (
                <PlayerSlotCard
                  key={player?.id ?? `b-empty-${index}`}
                  player={player}
                  isHost={room?.hostId === player?.id}
                  isCurrentUser={player?.id === user?.id}
                  onSwitchTeam={onSwitchTeam}
                />
              ))}
            </View>
          </View>

          {!isHost ? (
            <Pressable
              disabled={updating}
              onPress={() => void onToggleReady()}
              style={[
                styles.readyButton,
                myPlayer?.isReady ? styles.readyButtonActive : styles.readyButtonIdle,
                updating && styles.disabledButton,
              ]}
            >
              <Text style={[styles.readyButtonText, myPlayer?.isReady ? styles.readyButtonTextActive : null]}>
                {myPlayer?.isReady ? "✓ Ready" : "Tap to Ready Up"}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.hostActions}>
              <Pressable
                disabled={!canStart || updating}
                style={[styles.startButton, (!canStart || updating) && styles.disabledButton]}
                onPress={() => void onStartGame()}
              >
                <Text style={styles.startButtonText}>Start Game</Text>
              </Pressable>
              {!canStart ? <Text style={styles.startHint}>{startDisabledReason}</Text> : null}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlayerSlotCard({
  player,
  isCurrentUser,
  isHost,
  onSwitchTeam,
}: {
  player: RoomMember | null;
  isCurrentUser: boolean;
  isHost: boolean;
  onSwitchTeam: (player: RoomMember) => Promise<void>;
}): JSX.Element {
  if (!player) {
    return (
      <View style={styles.emptySlot}>
        <View style={styles.emptyCircle} />
        <Text style={styles.emptyText}>Waiting...</Text>
      </View>
    );
  }

  const teamColor = TEAM_COLORS[player.team];
  return (
    <View style={[styles.playerCard, { borderColor: teamColor }]}>
      <View style={[styles.avatarCircle, { backgroundColor: teamColor }]}>
        <Text style={styles.avatarInitials}>{getInitials(player.displayName)}</Text>
      </View>
      <Text style={styles.playerName} numberOfLines={1}>
        {player.displayName}
      </Text>
      <Text style={player.isReady ? styles.readyText : styles.notReadyText}>
        {player.isReady ? "✓" : "○"} {player.isReady ? "Ready" : "Not ready"}
      </Text>
      <View style={styles.metaRow}>
        {isCurrentUser ? <Text style={styles.youBadge}>You</Text> : null}
        {isHost ? <Text style={styles.hostBadge}>Host ♛</Text> : null}
      </View>
      {isCurrentUser ? (
        <Pressable style={styles.switchTeamButton} onPress={() => void onSwitchTeam(player)}>
          <Text style={styles.switchTeamText}>
            {player.team === Team.TEAM_A ? "→ Team B" : "→ Team A"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  contentWrap: {
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
    gap: 12,
  },
  loadingText: {
    color: "#f1f5f9",
    fontWeight: "700",
    textAlign: "center",
    marginTop: 32,
  },
  roomCodeCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    padding: 10,
    alignItems: "center",
    gap: 6,
  },
  roomCodeLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  roomCode: {
    color: "#f59e0b",
    fontFamily: "monospace",
    fontWeight: "900",
    fontSize: 28,
    letterSpacing: 2,
  },
  codeActions: {
    flexDirection: "row",
    gap: 8,
  },
  codeActionButton: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: "#0f172a",
  },
  codeActionText: {
    color: "#f1f5f9",
    fontSize: 12,
    fontWeight: "700",
  },
  playerCount: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  gridRow: {
    flexDirection: "row",
    gap: 10,
  },
  teamColumn: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    padding: 8,
    gap: 8,
  },
  teamPill: {
    alignSelf: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    color: "#f1f5f9",
    fontWeight: "800",
    fontSize: 12,
  },
  teamAPill: {
    backgroundColor: "rgba(59,130,246,0.22)",
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  teamBPill: {
    backgroundColor: "rgba(239,68,68,0.22)",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  playerCard: {
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "#0f172a",
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 4,
    height: 178,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 16,
  },
  playerName: {
    color: "#f1f5f9",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  readyText: {
    color: "#22c55e",
    fontSize: 12,
    fontWeight: "700",
  },
  notReadyText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    gap: 6,
  },
  youBadge: {
    color: "#111827",
    backgroundColor: "#f59e0b",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: "800",
  },
  hostBadge: {
    color: "#f1f5f9",
    backgroundColor: "#334155",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: "700",
  },
  switchTeamButton: {
    marginTop: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: "#1e293b",
  },
  switchTeamText: {
    color: "#f1f5f9",
    fontSize: 11,
    fontWeight: "700",
  },
  emptySlot: {
    height: 178,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#475569",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(15,23,42,0.6)",
  },
  emptyCircle: {
    width: 52,
    height: 52,
    borderRadius: 999,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#64748b",
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  readyButton: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  readyButtonIdle: {
    borderWidth: 1.5,
    borderColor: "#64748b",
    backgroundColor: "transparent",
  },
  readyButtonActive: {
    backgroundColor: "#22c55e",
  },
  readyButtonText: {
    color: "#f1f5f9",
    fontWeight: "800",
    fontSize: 15,
  },
  readyButtonTextActive: {
    color: "#052e16",
  },
  hostActions: {
    gap: 8,
  },
  startButton: {
    borderRadius: 12,
    backgroundColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  startButtonText: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 15,
  },
  startHint: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  disabledButton: {
    opacity: 0.55,
  },
});
