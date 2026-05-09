import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Team, type Player } from "@shared/src";

interface PlayerSlotProps {
  player: Player;
  selected?: boolean;
  pressable?: boolean;
  onPress?: () => void;
  showCardCount?: boolean;
  isCurrentTurn?: boolean;
}

export function PlayerSlot({
  player,
  selected = false,
  pressable = false,
  onPress,
  showCardCount = true,
  isCurrentTurn = false,
}: PlayerSlotProps): JSX.Element {
  const initials = player.displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const glow = useSharedValue(0);
  React.useEffect(() => {
    if (isCurrentTurn) {
      glow.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
    } else {
      glow.value = withTiming(0, { duration: 180 });
    }
  }, [glow, isCurrentTurn]);

  const animatedStyle = useAnimatedStyle(() => ({
    shadowOpacity: isCurrentTurn ? 0.25 + 0.2 * glow.value : 0,
    shadowRadius: isCurrentTurn ? 8 + 6 * glow.value : 0,
  }));

  return (
    <Animated.View style={[animatedStyle, isCurrentTurn && styles.currentTurnGlow]}>
      <Pressable
        disabled={!pressable}
        onPress={onPress}
        style={[
          styles.container,
          player.team === Team.TEAM_A ? styles.teamA : styles.teamB,
          selected && styles.selected,
          isCurrentTurn && styles.currentTurn,
          !player.isConnected && styles.disconnected,
        ]}
      >
        <View style={styles.avatarWrap}>
          <View style={[styles.avatarCircle, player.team === Team.TEAM_A ? styles.avatarA : styles.avatarB]}>
            <Text style={styles.avatarText}>{initials || "?"}</Text>
          </View>
          {showCardCount ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{player.handCount}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {player.displayName}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 6,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  teamA: {
    backgroundColor: "rgba(59,130,246,0.18)",
  },
  teamB: {
    backgroundColor: "rgba(239,68,68,0.18)",
  },
  name: {
    fontWeight: "600",
    color: "#f8fafc",
    fontSize: 11,
    flexShrink: 1,
    maxWidth: 72,
    textAlign: "center",
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarA: {
    backgroundColor: "#3b82f6",
  },
  avatarB: {
    backgroundColor: "#ef4444",
  },
  avatarText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },
  badge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    backgroundColor: "#111827",
    borderRadius: 999,
    minWidth: 20,
    alignItems: "center",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#f8fafc",
  },
  badgeText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 10,
  },
  selected: {
    borderColor: "#f59e0b",
    borderWidth: 2,
  },
  currentTurn: {
    borderWidth: 2,
    borderColor: "#f59e0b",
  },
  currentTurnGlow: {
    shadowColor: "#f59e0b",
    shadowOffset: { width: 0, height: 0 },
  },
  disconnected: {
    opacity: 0.45,
  },
});
