import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";

import { useAuth } from "../../hooks/useAuth";
import { useAudioSettingsStore } from "../../store/audioSettingsStore";
import { formatDisplayName, isValidDisplayName } from "../../utils/nameHelpers";
import { presetAvatarUrl } from "../../utils/avatarPresets";

const getInitials = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

export default function ProfileScreen(): JSX.Element {
  const { user, signOut, updateProfile } = useAuth();
  const soundsMuted = useAudioSettingsStore((s) => s.soundsMuted);
  const setSoundsMuted = useAudioSettingsStore((s) => s.setSoundsMuted);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(formatDisplayName(user?.displayName));
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingPreset, setSavingPreset] = useState<number | null>(null);
  const [savingNoPicture, setSavingNoPicture] = useState(false);

  useEffect(() => {
    setNameDraft(formatDisplayName(user?.displayName));
  }, [user?.displayName]);

  const stats = useMemo(
    () => [
      { label: "Games Played", value: String(user?.gamesPlayed ?? 0) },
      { label: "Games Won", value: String(user?.gamesWon ?? 0) },
      { label: "Win Rate", value: `${user?.winRate ?? 0}%` },
      // Coins UI hidden for now — restore when implementing:
      // { label: "Coins", value: String(user?.coins ?? 0) },
    ],
    [user?.gamesPlayed, user?.gamesWon, user?.winRate /*, user?.coins */],
  );

  const avatarUri = user?.avatarUrl?.trim() ? user.avatarUrl.trim() : null;
  const initialsOnly = !avatarUri;
  const avatarBusy = savingPreset !== null || savingNoPicture;

  const onSignOut = (): void => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          void signOut();
        },
      },
    ]);
  };

  const onChangeName = (value: string): void => {
    const nextValue = formatDisplayName(value);
    setNameDraft(nextValue);
    setNameError(null);
  };

  const onNameBlur = (): void => {
    if (!isValidDisplayName(nameDraft)) {
      setNameError("Use 1-15 letters/numbers.");
      setNameDraft(formatDisplayName(nameDraft));
      setEditingName(false);
      return;
    }
    setEditingName(false);
    const next = formatDisplayName(nameDraft);
    if (next !== formatDisplayName(user?.displayName)) {
      void (async () => {
        try {
          await updateProfile({ displayName: next });
        } catch (err) {
          setNameError(err instanceof Error ? err.message : "Could not save name.");
        }
      })();
    }
  };

  const onPickPreset = async (preset: number): Promise<void> => {
    if (preset === user?.avatarPreset && avatarUri) {
      return;
    }
    if (avatarBusy) {
      return;
    }
    setSavingPreset(preset);
    try {
      await updateProfile({ avatarPreset: preset });
    } catch (err) {
      Alert.alert("Avatar", err instanceof Error ? err.message : "Could not update avatar.");
    } finally {
      setSavingPreset(null);
    }
  };

  const onUseNoPicture = async (): Promise<void> => {
    if (initialsOnly && user?.avatarPreset == null) {
      return;
    }
    if (avatarBusy) {
      return;
    }
    setSavingNoPicture(true);
    try {
      await updateProfile({ avatarPreset: null });
    } catch (err) {
      Alert.alert("Avatar", err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setSavingNoPicture(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topCard}>
          <View style={styles.avatar}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Text style={styles.avatarText}>{getInitials(user?.displayName ?? "Player")}</Text>
            )}
          </View>
          {editingName ? (
            <TextInput
              value={nameDraft}
              onChangeText={onChangeName}
              style={styles.nameInput}
              autoFocus
              maxLength={15}
              autoCapitalize="characters"
              onBlur={onNameBlur}
            />
          ) : (
            <View style={styles.nameRow}>
              <Text style={styles.name}>{nameDraft}</Text>
              <Pressable onPress={() => setEditingName(true)}>
                <Text style={styles.editIcon}>✎</Text>
              </Pressable>
            </View>
          )}
          <Text style={styles.email}>google-user@literature.app</Text>
          {nameError ? <Text style={styles.nameError}>{nameError}</Text> : null}
          <Pressable style={styles.editButton} onPress={() => setEditingName((v) => !v)}>
            <Text style={styles.editButtonText}>Edit Name</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={styles.sectionTitle}>Sound effects</Text>
              <Text style={styles.sectionHint}>Mute all game and lobby sounds.</Text>
            </View>
            <Switch
              value={soundsMuted}
              onValueChange={(v) => setSoundsMuted(v)}
              trackColor={{ false: "#334155", true: "#475569" }}
              thumbColor={soundsMuted ? "#94a3b8" : "#f59e0b"}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHint}>Optional — cartoon avatar, or initials only in the lobby and game.</Text>
          <View style={styles.presetRows}>
            {[0, 4].map((rowStart) => (
              <View key={rowStart} style={styles.presetRow}>
                {Array.from({ length: 4 }, (_, j) => {
                  const preset = rowStart + j + 1;
                  const selected = user?.avatarPreset === preset;
                  const busy = savingPreset === preset;
                  return (
                    <Pressable
                      key={preset}
                      style={[styles.presetCell, selected && styles.presetCellSelected]}
                      onPress={() => void onPickPreset(preset)}
                      disabled={busy || avatarBusy}
                    >
                      <Image
                        source={{ uri: presetAvatarUrl(preset) }}
                        style={styles.presetImage}
                        resizeMode="cover"
                      />
                      {busy ? (
                        <View style={styles.presetBusy}>
                          <ActivityIndicator color="#f59e0b" />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          <Pressable
            style={[styles.noPictureButton, initialsOnly && styles.noPictureButtonSelected]}
            onPress={() => void onUseNoPicture()}
            disabled={avatarBusy}
          >
            {savingNoPicture ? (
              <ActivityIndicator color="#f1f5f9" />
            ) : (
              <Text style={styles.noPictureButtonText}>No picture — use my initials</Text>
            )}
          </Pressable>
          <Text style={styles.noPictureHint}>No image is sent to other players; they see your initials instead.</Text>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Achievements UI hidden for now — restore when implementing:
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Achievements</Text>
          <View style={styles.badgeWrap}>
            ...
          </View>
        </View>
        */}

        {/* Coins UI hidden for now — restore when implementing:
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coins</Text>
          <Text style={styles.coins}>🪙 {user?.coins ?? 0}</Text>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Get More Coins</Text>
          </Pressable>
        </View>
        */}

        <View style={styles.section}>
          <Text style={styles.dangerTitle}>Danger Zone</Text>
          <Pressable style={styles.signOutButton} onPress={onSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const PRESET_GAP = 10;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  content: { padding: 16, gap: 14, paddingBottom: 24 },
  topCard: {
    backgroundColor: "#1e293b",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 999,
    backgroundColor: "#0f172a",
    borderColor: "#334155",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { color: "#f1f5f9", fontSize: 26, fontWeight: "900" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { color: "#f1f5f9", fontSize: 22, fontWeight: "800" },
  nameError: { color: "#ef4444", fontSize: 12, fontWeight: "700" },
  editIcon: { color: "#f59e0b", fontSize: 16 },
  email: { color: "#94a3b8", fontSize: 13 },
  nameInput: {
    width: "100%",
    backgroundColor: "#0f172a",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f1f5f9",
    textAlign: "center",
    fontWeight: "700",
  },
  editButton: {
    borderRadius: 10,
    backgroundColor: "#f59e0b",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  editButtonText: { color: "#111827", fontWeight: "800" },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  settingTextCol: { flex: 1, gap: 4 },
  sectionHint: { color: "#64748b", fontSize: 12, marginTop: -4 },
  presetRows: {
    gap: PRESET_GAP,
    marginTop: 4,
  },
  presetRow: {
    flexDirection: "row",
    gap: PRESET_GAP,
  },
  presetCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden",
    backgroundColor: "#0f172a",
  },
  presetCellSelected: {
    borderColor: "#f59e0b",
  },
  presetImage: {
    width: "100%",
    height: "100%",
  },
  presetBusy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.55)",
  },
  noPictureButton: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#334155",
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
  },
  noPictureButtonSelected: {
    borderColor: "#f59e0b",
  },
  noPictureButtonText: {
    color: "#f1f5f9",
    fontWeight: "800",
    fontSize: 14,
    textAlign: "center",
  },
  noPictureHint: {
    color: "#64748b",
    fontSize: 11,
    textAlign: "center",
    marginTop: 2,
  },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    width: "48%",
    backgroundColor: "#1e293b",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    gap: 4,
  },
  statValue: { color: "#f59e0b", fontSize: 20, fontWeight: "900" },
  statLabel: { color: "#94a3b8", fontSize: 12 },
  section: {
    backgroundColor: "#1e293b",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  sectionTitle: { color: "#f1f5f9", fontWeight: "800", fontSize: 16 },
  badgeWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#22c55e",
    backgroundColor: "rgba(34,197,94,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeLocked: {
    borderColor: "#475569",
    backgroundColor: "rgba(71,85,105,0.2)",
  },
  badgeText: { color: "#22c55e", fontWeight: "700", fontSize: 12 },
  badgeTextLocked: { color: "#94a3b8" },
  coins: { color: "#f59e0b", fontWeight: "900", fontSize: 28 },
  primaryButton: {
    borderRadius: 10,
    backgroundColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  primaryButtonText: { color: "#111827", fontWeight: "800" },
  dangerTitle: { color: "#ef4444", fontWeight: "800" },
  signOutButton: {
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  signOutText: { color: "#ef4444", fontWeight: "800" },
});
