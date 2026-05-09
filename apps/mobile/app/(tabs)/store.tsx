import React from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

const COIN_PACKS = [
  { title: "Small", coins: 100, price: "₹89" },
  { title: "Medium", coins: 500, price: "₹399", best: true },
  { title: "Large", coins: 1200, price: "₹799" },
];

export default function StoreScreen(): JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Balance</Text>
          <Text style={styles.balanceValue}>🪙 0</Text>
        </View>

        <Text style={styles.sectionTitle}>Coin Packs</Text>
        <View style={styles.row}>
          {COIN_PACKS.map((pack) => (
            <View key={pack.title} style={styles.packCard}>
              {pack.best ? <Text style={styles.bestValue}>BEST VALUE</Text> : null}
              <Text style={styles.packTitle}>{pack.title}</Text>
              <Text style={styles.packCoins}>🪙 {pack.coins}</Text>
              <Text style={styles.packPrice}>{pack.price}</Text>
              <Pressable style={styles.buyButton}>
                <Text style={styles.buyButtonText}>Buy</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Cosmetics</Text>
        <View style={styles.surface}>
          {["Classic Cards", "Neon Cards", "Retro Cards"].map((item, index) => (
            <View key={item} style={styles.cosmeticRow}>
              <View style={styles.preview} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cosmeticName}>{item}</Text>
                <Text style={styles.cosmeticPrice}>{(index + 1) * 200} coins</Text>
              </View>
              {index === 0 ? <Text style={styles.ownedBadge}>Owned</Text> : <Pressable style={styles.buyMini}><Text style={styles.buyMiniText}>Buy</Text></Pressable>}
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Ad Free</Text>
        <View style={styles.surface}>
          <Text style={styles.cosmeticName}>Remove all ads forever</Text>
          <Text style={styles.packPrice}>₹299</Text>
          <Pressable style={styles.buyButton}>
            <Text style={styles.buyButtonText}>Purchase</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  balanceCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1e293b",
    padding: 12,
  },
  balanceLabel: { color: "#94a3b8", fontWeight: "700" },
  balanceValue: { color: "#f59e0b", fontSize: 28, fontWeight: "900", marginTop: 4 },
  sectionTitle: { color: "#f1f5f9", fontWeight: "800", fontSize: 16, marginTop: 6 },
  row: { flexDirection: "row", gap: 8 },
  packCard: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  bestValue: {
    color: "#111827",
    backgroundColor: "#f59e0b",
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontSize: 9,
    fontWeight: "800",
  },
  packTitle: { color: "#f1f5f9", fontWeight: "700" },
  packCoins: { color: "#f59e0b", fontWeight: "900", fontSize: 16 },
  packPrice: { color: "#f1f5f9", fontWeight: "800" },
  buyButton: {
    backgroundColor: "#f59e0b",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  buyButtonText: { color: "#111827", fontWeight: "800" },
  surface: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  cosmeticRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  preview: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
  },
  cosmeticName: { color: "#f1f5f9", fontWeight: "700" },
  cosmeticPrice: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  ownedBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#22c55e",
    color: "#22c55e",
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: "700",
  },
  buyMini: {
    borderRadius: 999,
    backgroundColor: "#f59e0b",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  buyMiniText: { color: "#111827", fontWeight: "800", fontSize: 11 },
});
