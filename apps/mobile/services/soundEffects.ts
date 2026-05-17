import * as Haptics from "expo-haptics";
import { requireOptionalNativeModule } from "expo-modules-core";
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

/** True when native `expo-av` is not in this binary (e.g. old dev client) — use haptics only. */
let avUnavailable = false;

type LoadedSound = {
  setPositionAsync: (positionMillis: number) => Promise<unknown>;
  playAsync: () => Promise<unknown>;
};

const pool: Partial<Record<SfxId, LoadedSound>> = {};
let initPromise: Promise<void> | null = null;

function nativeExponentAvLinked(): boolean {
  if (Platform.OS !== "android" && Platform.OS !== "ios") {
    return false;
  }
  try {
    return requireOptionalNativeModule("ExponentAV") != null;
  } catch {
    return false;
  }
}

function tryRequireExpoAv(): typeof import("expo-av") | null {
  if (!nativeExponentAvLinked()) {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-av") as typeof import("expo-av");
  } catch {
    return null;
  }
}

function hapticFor(id: SfxId): Promise<void> {
  switch (id) {
    case "tap":
      return Haptics.selectionAsync();
    case "card":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    case "confirm":
    case "askHit":
    case "declareWin":
    case "victory":
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case "turn":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    case "askMiss":
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    case "declareLose":
    case "defeat":
    case "error":
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    case "deal":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
}

/**
 * Preload WAV SFX when `ExponentAV` is linked in this native build.
 * If you only feel vibration, rebuild the app (`expo run:android` or EAS) after adding `expo-av`.
 */
export async function initSfx(): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }
  if (avUnavailable) {
    return;
  }
  if (initPromise) {
    return initPromise;
  }
  initPromise = (async () => {
    try {
      const av = tryRequireExpoAv();
      if (!av?.Audio) {
        avUnavailable = true;
        return;
      }
      const { Audio } = av;
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
            volume: 1,
            isLooping: false,
          });
          pool[id] = sound as LoadedSound;
        } catch {
          // skip broken slot
        }
      }
    } catch {
      avUnavailable = true;
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
    if (!avUnavailable && sound) {
      try {
        await sound.setPositionAsync(0);
        await sound.playAsync();
        return;
      } catch {
        // fall through to haptics
      }
    }
    void hapticFor(id).catch(() => {
      /* unsupported device */
    });
  })();
}
