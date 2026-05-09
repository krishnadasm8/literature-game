import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, ToastAndroid, View } from "react-native";
import { useRouter } from "expo-router";

import { createRoom, joinRoom } from "../../services/roomService";

export default function LobbyScreen(): JSX.Element {
  const router = useRouter();
  const [maxPlayers, setMaxPlayers] = useState<4 | 6 | 8>(6);
  const [roomCode, setRoomCode] = useState("");
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);

  const canJoin = useMemo(() => roomCode.length === 6, [roomCode.length]);

  const showError = (message: string): void => {
    if (ToastAndroid) {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }
    Alert.alert("Error", message);
  };

  const onCreate = async (): Promise<void> => {
    setLoadingCreate(true);
    try {
      const response = await createRoom(maxPlayers);
      router.push(`/room/${response.roomCode ?? response.room.roomCode}`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not create room.");
    } finally {
      setLoadingCreate(false);
    }
  };

  const onJoin = async (): Promise<void> => {
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6) {
      showError("Enter a valid 6-character room code.");
      return;
    }
    setLoadingJoin(true);
    try {
      await joinRoom(code);
      router.push(`/room/${code}`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not join room.");
    } finally {
      setLoadingJoin(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lobby</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Create Room</Text>
        <View style={styles.segmentRow}>
          {[4, 6, 8].map((count) => (
            <Pressable
              key={count}
              style={[
                styles.segment,
                maxPlayers === count ? styles.segmentActive : null,
              ]}
              onPress={() => setMaxPlayers(count as 4 | 6 | 8)}
            >
              <Text style={styles.segmentText}>{count}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={[styles.primaryButton, loadingCreate && styles.disabled]}
          disabled={loadingCreate}
          onPress={() => void onCreate()}
        >
          <Text style={styles.primaryButtonText}>{loadingCreate ? "Creating..." : "Create"}</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Join Room</Text>
        <TextInput
          style={styles.input}
          value={roomCode}
          autoCapitalize="characters"
          maxLength={6}
          placeholder="ABC123"
          onChangeText={(value) => setRoomCode(value.toUpperCase())}
        />
        <Pressable
          style={[styles.primaryButton, (!canJoin || loadingJoin) && styles.disabled]}
          disabled={!canJoin || loadingJoin}
          onPress={() => void onJoin()}
        >
          <Text style={styles.primaryButtonText}>{loadingJoin ? "Joining..." : "Join"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 14,
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  section: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 10,
  },
  sectionTitle: {
    fontWeight: "700",
    color: "#111827",
  },
  segmentRow: {
    flexDirection: "row",
    gap: 8,
  },
  segment: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  segmentActive: {
    borderColor: "#2563eb",
    backgroundColor: "#dbeafe",
  },
  segmentText: {
    fontWeight: "700",
    color: "#111827",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    letterSpacing: 1.5,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  primaryButton: {
    borderRadius: 10,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.5,
  },
});
