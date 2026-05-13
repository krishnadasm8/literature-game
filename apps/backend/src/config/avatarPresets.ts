/** Fixed cartoon-style presets (DiceBear avataaars). Keep in sync with `apps/mobile/utils/avatarPresets.ts`. */
export const AVATAR_PRESET_SEEDS = ["Luna", "Max", "Zoe", "Kai", "Ivy", "Otto", "Nia", "Ben"] as const;

export const AVATAR_PRESET_COUNT = AVATAR_PRESET_SEEDS.length;

export function isValidAvatarPreset(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= AVATAR_PRESET_COUNT;
}

/** 1-based preset index (1…COUNT) → PNG URL. */
export function presetAvatarUrl(presetIndex: number): string {
  const seed = AVATAR_PRESET_SEEDS[presetIndex - 1]!;
  return `https://api.dicebear.com/9.x/avataaars/png?seed=${encodeURIComponent(seed)}&size=256`;
}
