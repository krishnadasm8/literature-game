import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function StoreScreen(): JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Store</Text>
      <Text style={styles.subtitle}>Store screen stub.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#4b5563",
  },
});
