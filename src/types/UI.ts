import { Action } from "./Action";
import { BlindIncreaseModes } from "./Table";

type Card = string;
export interface Player {
  id: string;
  cards: Card[];
  stack: number;
  bet: number | null;
  dealer: boolean;
  smallBlind: boolean,
  bigBlind: boolean,
  lastAction: Action | null;
  folded: boolean;
  address: string;
  name?: string;
  pfp: string;
  lastBet: number;
}

export interface Seats {
  [seatId: number]: Player | null;
}

export interface TemplateTable {
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
  payToken: number;
  payTokenName: string;
  payTokenAddress: string;
  payTokenDecimal: number;
  status: boolean;

}

export interface Pot {
  total: number;
}
