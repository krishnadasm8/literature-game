import React, { useMemo } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

import { useAuthStore } from "../../store/authStore";

const COLORS = {
  bg: "#0f172a",
  surface: "#1e293b",
  primary: "#f59e0b",
  text: "#f1f5f9",
  muted: "#94a3b8",
  border: "#334155",
  success: "#22c55e",
  danger: "#ef4444",
};

const getInitials = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

export default function HomeScreen(): JSX.Element {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const gamesPlayed = user?.gamesPlayed ?? 0;
  const wins = user?.gamesWon ?? 0;
  const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
  const recentGames = useMemo(() => [] as Array<{ id: string }>, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.logo}>LITERATURE</Text>
            <Text style={styles.subtitle}>Canadian Card Game</Text>
          </View>
          <View style={styles.greetingWrap}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{getInitials(user?.displayName ?? "Player")}</Text>
            </View>
            <Text style={styles.greeting} numberOfLines={1}>
              Hello, {user?.displayName ?? "Player"}!
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{gamesPlayed}</Text>
            <Text style={styles.statLabel}>Games</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{wins}</Text>
            <Text style={styles.statLabel}>Wins</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{winRate}%</Text>
            <Text style={styles.statLabel}>Win Rate</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.createButton} onPress={() => router.push("/(tabs)/lobby")}>
            <Text style={styles.createButtonText}>Create Room</Text>
          </Pressable>
          <Pressable style={styles.joinButton} onPress={() => router.push({ pathname: "/(tabs)/lobby", params: { tab: "join" } })}>
            <Text style={styles.joinButtonText}>Join Room</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Games</Text>
          {recentGames.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyIcon}>♠ ♥ ♦ ♣</Text>
              <Text style={styles.emptyText}>No games yet. Start playing!</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.version}>v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, gap: 16, paddingBottom: 24 },
  heroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  logo: { color: COLORS.primary, fontSize: 30, fontWeight: "900", letterSpacing: 1 },
  subtitle: { color: COLORS.muted, marginTop: 2, fontSize: 13 },
  greetingWrap: { alignItems: "center", width: 110, gap: 6 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: COLORS.text, fontWeight: "800" },
  greeting: { color: COLORS.text, fontSize: 12, textAlign: "center" },
  statsRow: { flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  statValue: { color: COLORS.primary, fontSize: 20, fontWeight: "900" },
  statLabel: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  actions: { gap: 10 },
  createButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  createButtonText: { color: "#111827", fontWeight: "800", fontSize: 16 },
  joinButton: {
    borderColor: COLORS.primary,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  joinButtonText: { color: COLORS.primary, fontWeight: "800", fontSize: 16 },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    gap: 10,
  },
  sectionTitle: { color: COLORS.text, fontWeight: "800", fontSize: 16 },
  emptyBlock: { alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 8 },
  emptyIcon: { color: COLORS.muted, fontSize: 16 },
  emptyText: { color: COLORS.muted, fontSize: 13 },
  version: { color: COLORS.muted, fontSize: 11, textAlign: "center", marginTop: 4 },
});
