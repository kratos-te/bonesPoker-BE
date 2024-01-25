export interface Pot {
  total: number;
  maxBet: number;
  locked: boolean;
  playerBets: { [playerId: string]: number };
}
