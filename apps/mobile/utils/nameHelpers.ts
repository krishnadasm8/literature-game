export const formatDisplayName = (name?: string | null): string => {
  if (!name) {
    return "Player";
  }
  return name
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

/** Used by profile name editing — matches title-case display names, 1–15 chars. */
export const isValidDisplayName = (value: string): boolean => {
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= 15 && /^[a-zA-Z0-9 ]+$/.test(trimmed);
};
