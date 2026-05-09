import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

interface TurnIndicatorProps {
  isMyTurn: boolean;
  currentPlayerName?: string;
}

export function TurnIndicator({ isMyTurn, currentPlayerName }: TurnIndicatorProps): JSX.Element {
  const pulse = useSharedValue(1);

  React.useEffect(() => {
    if (isMyTurn) {
      pulse.value = withRepeat(withTiming(1.05, { duration: 650 }), -1, true);
    } else {
      pulse.value = withTiming(1, { duration: 160 });
    }
  }, [isMyTurn, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View style={[styles.container, isMyTurn && styles.active, animatedStyle]}>
      <Text style={styles.text}>{isMyTurn ? "Your turn" : `Waiting for ${currentPlayerName ?? "Unknown"}...`}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
  },
  active: {
    backgroundColor: "#dcfce7",
  },
  text: {
    fontWeight: "600",
    color: "#111827",
  },
});
