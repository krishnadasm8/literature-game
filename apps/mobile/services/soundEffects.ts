import { Audio } from "expo-av";
import { Platform } from "react-native";

import { useAudioSettingsStore } from "../store/audioSettingsStore";

export type SfxId =
  | "tap"
  | "card"
  | "confirm"
  | "turn"
  | "askHit"
  | "askMiss"
  | "declareWin"
  | "declareLose"
  | "victory"
  | "defeat"
  | "deal"
  | "error";

const SOURCES: Record<SfxId, number> = {
  tap: require("../assets/sounds/tap.wav"),
  card: require("../assets/sounds/card.wav"),
  confirm: require("../assets/sounds/confirm.wav"),
  turn: require("../assets/sounds/turn.wav"),
  askHit: require("../assets/sounds/ask_hit.wav"),
  askMiss: require("../assets/sounds/ask_miss.wav"),
  declareWin: require("../assets/sounds/declare_win.wav"),
  declareLose: require("../assets/sounds/declare_lose.wav"),
  victory: require("../assets/sounds/victory.wav"),
  defeat: require("../assets/sounds/defeat.wav"),
  deal: require("../assets/sounds/deal.wav"),
  error: require("../assets/sounds/error.wav"),
};

const pool: Partial<Record<SfxId, Audio.Sound>> = {};
let initPromise: Promise<void> | null = null;

/**
 * Preload WAV SFX (native). Web skips preload — optional UI sounds are no-ops there.
 */
export async function initSfx(): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }
  if (initPromise) {
    return initPromise;
  }
  initPromise = (async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch {
      // ignore
    }
    for (const id of Object.keys(SOURCES) as SfxId[]) {
      try {
        const { sound } = await Audio.Sound.createAsync(SOURCES[id], {
          shouldPlay: false,
          volume: 0.88,
          isLooping: false,
        });
        pool[id] = sound;
      } catch {
        // skip broken slot
      }
    }
  })();
  return initPromise;
}

export function playSfx(id: SfxId): void {
  if (Platform.OS === "web") {
    return;
  }
  if (useAudioSettingsStore.getState().soundsMuted) {
    return;
  }
  void (async () => {
    await initSfx();
    const sound = pool[id];
    if (!sound) {
      return;
    }
    try {
      await sound.setPositionAsync(0);
      await sound.playAsync();
    } catch {
      // ignore playback errors
    }
  })();
}
