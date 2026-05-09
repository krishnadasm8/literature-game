import React, { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { api } from "../../services/api";
import { useAuthStore } from "../../store/authStore";

interface RoomApiResponse {
  room: {
    roomCode: string;
  };
  roomCode?: string;
}

export default function LobbyScreen(): JSX.Element {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 390;
  const accessToken = useAuthStore((state) => state.accessToken);
  const [maxPlayers, setMaxPlayers] = useState<4 | 6 | 8>(6);
  const [roomCode, setRoomCode] = useState("");
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const canJoin = useMemo(() => roomCode.length === 6, [roomCode.length]);

  const showError = (message: string): void => {
    setErrorMessage(message);
    if (ToastAndroid) {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }
    Alert.alert("Error", message);
  };

  const onCreate = async (): Promise<void> => {
    setLoadingCreate(true);
    setErrorMessage(null);
    try {
      const response = await api.post<RoomApiResponse>(
        "/rooms",
        { maxPlayers },
        {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        },
      );
      const code = response.data.roomCode ?? response.data.room.roomCode;
      setCreatedRoomCode(code);
      setShowCreateModal(true);
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
    setErrorMessage(null);
    try {
      await api.get<RoomApiResponse>(`/rooms/${code}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      router.push(`/room/${code}`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not join room.");
    } finally {
      setLoadingJoin(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.contentContainer, isSmallScreen && styles.contentContainerSmall]}
        keyboardShouldPersistTaps="handled"
      >
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

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </ScrollView>

      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Room Created</Text>
            <Text style={styles.modalCode}>{createdRoomCode}</Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() => {
                if (!createdRoomCode) {
                  return;
                }
                setShowCreateModal(false);
                router.push(`/room/${createdRoomCode}`);
              }}
            >
              <Text style={styles.primaryButtonText}>Enter Room</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  contentContainer: {
    gap: 14,
    padding: 24,
    paddingBottom: 28,
  },
  contentContainerSmall: {
    paddingHorizontal: 14,
    gap: 10,
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
    flexWrap: "wrap",
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
  errorText: {
    color: "#dc2626",
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#ffffff",
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  modalCode: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#2563eb",
    textAlign: "center",
  },
});
