import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

interface ButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}

export function Button({ label, onPress, disabled = false }: ButtonProps): JSX.Element {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    backgroundColor: "#9ca3af",
  },
  label: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
