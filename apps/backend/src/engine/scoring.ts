export interface TeamScore {
  teamId: "TEAM_A" | "TEAM_B";
  value: number;
}

export const calculateRoundScore = (_booksClaimed: string[]): TeamScore[] => {
  return [];
};

export const determineWinner = (_scores: TeamScore[]): TeamScore | null => {
  return null;
};
