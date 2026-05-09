import React from "react";
import { StyleSheet, View } from "react-native";

import type { Player } from "@shared/src";

import { PlayerSlot } from "./PlayerSlot";

interface RoomLobbyProps {
  players: Player[];
}

export function RoomLobby({ players }: RoomLobbyProps): JSX.Element {
  return (
    <View style={styles.container}>
      {players.map((player) => (
        <PlayerSlot key={player.id} player={player} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
});
