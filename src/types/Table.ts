export interface Table {
  id: string;
  name: string;
  startedAt: Date | null;
  endedAt: Date | null;
  numSeats: number;
  initialStack: number;
  minBet: number;
  buyIn: number;
  blindIncreaseMode: BlindIncreaseModes;
  blindIncreaseTime: number;
  blindIncreaseRound: number;
  blindIncreaseMulti: number;
  status: boolean;
  payToken: number;
}

export enum BlindIncreaseModes {
  TIME = "TIME",
  ROUND = "ROUND",
}
