import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface AudioSettingsState {
  soundsMuted: boolean;
  setSoundsMuted: (muted: boolean) => void;
}

export const useAudioSettingsStore = create<AudioSettingsState>()(
  persist(
    (set) => ({
      soundsMuted: false,
      setSoundsMuted: (muted) => set({ soundsMuted: muted }),
    }),
    {
      name: "literature-audio-settings",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ soundsMuted: s.soundsMuted }),
    },
  ),
);
