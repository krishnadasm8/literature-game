import React, { useMemo, useState } from "react";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { useAuth } from "../../hooks/useAuth";

const getInitials = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

const ACHIEVEMENTS = [
  { label: "First Win", unlocked: true },
  { label: "10 Games", unlocked: false },
  { label: "Perfect Declare", unlocked: false },
];

export default function ProfileScreen(): JSX.Element {
  const { user, signOut } = useAuth();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.displayName ?? "Player");

  const stats = useMemo(
    () => [
      { label: "Games Played", value: "0" },
      { label: "Games Won", value: "0" },
      { label: "Win Rate", value: "0%" },
      { label: "Score Declared", value: "0" },
    ],
    [],
  );

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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(user?.displayName ?? "Player")}</Text>
          </View>
          {editingName ? (
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              style={styles.nameInput}
              autoFocus
              onBlur={() => setEditingName(false)}
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
          <Pressable style={styles.editButton} onPress={() => setEditingName((v) => !v)}>
            <Text style={styles.editButtonText}>Edit Name</Text>
          </Pressable>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Achievements</Text>
          <View style={styles.badgeWrap}>
            {ACHIEVEMENTS.map((item) => (
              <View key={item.label} style={[styles.badge, !item.unlocked && styles.badgeLocked]}>
                <Text style={[styles.badgeText, !item.unlocked && styles.badgeTextLocked]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coins</Text>
          <Text style={styles.coins}>🪙 0</Text>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Get More Coins</Text>
          </Pressable>
        </View>

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
  },
  avatarText: { color: "#f1f5f9", fontSize: 26, fontWeight: "900" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { color: "#f1f5f9", fontSize: 22, fontWeight: "800" },
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
