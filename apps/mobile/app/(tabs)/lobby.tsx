import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";

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
  const [maxPlayers, setMaxPlayers] = useState<4 | 6 | 8>(4);
  const [roomCode, setRoomCode] = useState("");
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"CREATE" | "JOIN">("CREATE");

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
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.contentContainer, isSmallScreen && styles.contentContainerSmall]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Lobby</Text>
        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabButton, activeTab === "CREATE" && styles.tabButtonActive]}
            onPress={() => setActiveTab("CREATE")}
          >
            <Text style={[styles.tabButtonText, activeTab === "CREATE" && styles.tabButtonTextActive]}>Create</Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === "JOIN" && styles.tabButtonActive]}
            onPress={() => setActiveTab("JOIN")}
          >
            <Text style={[styles.tabButtonText, activeTab === "JOIN" && styles.tabButtonTextActive]}>Join</Text>
          </Pressable>
        </View>

        {activeTab === "CREATE" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>New Room</Text>
            <View style={styles.segmentRow}>
              {[4, 6, 8].map((count) => (
                <Pressable
                  key={count}
                  style={[styles.segment, maxPlayers === count && styles.segmentActive]}
                  onPress={() => setMaxPlayers(count as 4 | 6 | 8)}
                >
                  <Text style={[styles.segmentText, maxPlayers === count && styles.segmentTextActive]}>{count}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={[styles.primaryButton, loadingCreate && styles.disabled]}
              disabled={loadingCreate}
              onPress={() => void onCreate()}
            >
              {loadingCreate ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <Text style={styles.primaryButtonText}>Create Room</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Join Room</Text>
            <TextInput
              style={styles.input}
              value={roomCode}
              autoCapitalize="characters"
              maxLength={6}
              onChangeText={(value) => setRoomCode(value.toUpperCase())}
            />
            <Pressable
              style={[styles.primaryButton, (!canJoin || loadingJoin) && styles.disabled]}
              disabled={!canJoin || loadingJoin}
              onPress={() => void onJoin()}
            >
              {loadingJoin ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <Text style={styles.primaryButtonText}>Join Room</Text>
              )}
            </Pressable>
          </View>
        )}

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
              style={styles.secondaryButton}
              onPress={() => {
                if (!createdRoomCode) {
                  return;
                }
                void Clipboard.setStringAsync(createdRoomCode);
              }}
            >
              <Text style={styles.secondaryButtonText}>Copy Code</Text>
            </Pressable>
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
    backgroundColor: "#0f172a",
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
    fontWeight: "800",
    color: "#f1f5f9",
  },
  tabRow: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1e293b",
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  tabButtonActive: {
    backgroundColor: "#f59e0b",
  },
  tabButtonText: {
    color: "#94a3b8",
    fontWeight: "700",
  },
  tabButtonTextActive: {
    color: "#111827",
  },
  section: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    gap: 10,
  },
  sectionTitle: {
    fontWeight: "800",
    color: "#f1f5f9",
    fontSize: 16,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  segment: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#0f172a",
  },
  segmentActive: {
    borderColor: "#f59e0b",
    backgroundColor: "#f59e0b",
  },
  segmentText: {
    fontWeight: "700",
    color: "#f1f5f9",
  },
  segmentTextActive: {
    color: "#111827",
  },
  input: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 28,
    textAlign: "center",
    fontFamily: "monospace",
    letterSpacing: 1.5,
    color: "#f59e0b",
    backgroundColor: "#0f172a",
  },
  primaryButton: {
    borderRadius: 10,
    backgroundColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    minHeight: 48,
  },
  primaryButtonText: {
    color: "#111827",
    fontWeight: "800",
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: "#f59e0b",
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.5,
  },
  errorText: {
    color: "#ef4444",
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
    backgroundColor: "#1e293b",
    gap: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f1f5f9",
  },
  modalCode: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#f59e0b",
    textAlign: "center",
  },
});
