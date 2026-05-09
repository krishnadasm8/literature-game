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
      <Text style={[styles.text, isMyTurn && styles.activeText]}>
        {isMyTurn ? "YOUR TURN" : `Waiting for ${currentPlayerName ?? "Unknown"}...`}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.55)",
    alignItems: "center",
  },
  active: {
    backgroundColor: "#f59e0b",
    shadowColor: "#f59e0b",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  text: {
    fontWeight: "600",
    color: "#d1d5db",
    fontSize: 13,
  },
  activeText: {
    color: "#111827",
    fontWeight: "800",
  },
});
