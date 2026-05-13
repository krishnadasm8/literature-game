/**
 * Cartoon avatar presets (DiceBear avataaars). Must match `apps/backend/src/config/avatarPresets.ts` seeds & URL shape.
 */
export const AVATAR_PRESET_SEEDS = ["Luna", "Max", "Zoe", "Kai", "Ivy", "Otto", "Nia", "Ben"] as const;

export const AVATAR_PRESET_COUNT = AVATAR_PRESET_SEEDS.length;

export function presetAvatarUrl(presetIndex: number): string {
  const seed = AVATAR_PRESET_SEEDS[presetIndex - 1]!;
  return `https://api.dicebear.com/9.x/avataaars/png?seed=${encodeURIComponent(seed)}&size=256`;
}
