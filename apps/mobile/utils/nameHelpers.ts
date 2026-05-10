const INVALID_NAME_CHARACTERS = /[^A-Z0-9 ]/g;
const MULTI_SPACE = /\s+/g;

export const formatDisplayName = (value?: string | null): string => {
  const cleaned = (value ?? "")
    .toUpperCase()
    .replace(INVALID_NAME_CHARACTERS, "")
    .replace(MULTI_SPACE, " ")
    .trim();

  return (cleaned.slice(0, 15) || "PLAYER");
};

export const isValidDisplayName = (value: string): boolean => {
  return /^[A-Z0-9 ]{1,15}$/.test(value.trim());
};
