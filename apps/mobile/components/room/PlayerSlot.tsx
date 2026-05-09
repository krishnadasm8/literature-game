import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Team, type Player } from "@shared/src";
import { Avatar } from "../ui/Avatar";

interface PlayerSlotProps {
  player: Player;
  selected?: boolean;
  pressable?: boolean;
  onPress?: () => void;
  showCardCount?: boolean;
}

export function PlayerSlot({
  player,
  selected = false,
  pressable = false,
  onPress,
  showCardCount = true,
}: PlayerSlotProps): JSX.Element {
  return (
    <Pressable
      disabled={!pressable}
      onPress={onPress}
      style={[
        styles.container,
        player.team === Team.TEAM_A ? styles.teamA : styles.teamB,
        selected && styles.selected,
        !player.isConnected && styles.disconnected,
      ]}
    >
      <View style={styles.identityRow}>
        <Avatar displayName={player.displayName} avatarUrl={player.avatarUrl} size={30} />
        <Text style={styles.name}>{player.displayName}</Text>
      </View>
      {showCardCount ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{player.handCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 92,
    gap: 8,
  },
  teamA: {
    borderColor: "#3b82f6",
    backgroundColor: "#dbeafe",
  },
  teamB: {
    borderColor: "#ef4444",
    backgroundColor: "#fee2e2",
  },
  name: {
    fontWeight: "700",
    color: "#111827",
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#111827",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  selected: {
    borderColor: "#0f172a",
    borderWidth: 2,
  },
  disconnected: {
    opacity: 0.5,
  },
});
