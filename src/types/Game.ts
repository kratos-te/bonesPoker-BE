import { Card } from "./Card";
import { Pot } from "./Pot";
import { Street } from "./Street";
import { BlindIncreaseModes } from "./Table";
import { Winner } from "./Winner";

export interface Game {
  id: string;
  tableId: string;
  currentPlayerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  endedAt: Date | null;
  bet: number;
  communityCards: Card[];
  prevCommunityCards: Card[];
  street: Street;
  hand: number;
  updatedHand: number;
  numSeats: number;
  minBet: number;
  initialStack: number;
  startedAt: Date | null;
  dealer: string | null;
  winners: Winner[] | null;
  pots: Pot[];
  buyIn: number;
  ended: boolean;
  blindIncreaseMode: BlindIncreaseModes;
  blindIncreaseTime: number;
  blindIncreaseRound: number;
  blindIncreaseMulti: number;
  mode: GameMode;
  payToken: number;
}

export interface ActiveGame {
  id: string;
  name: string;
  gameId: string;
  tableId: string;
  currentPlayerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  endedAt: Date | null;
  bet: number;
  communityCards: Card[];
  street: Street;
  hand: number;
  updatedHand: number;
  numSeats: number;
  minBet: number;
  initialStack: number;
  startedAt: Date | null;
  dealer: string | null;
  winners: Winner[] | null;
  pots: Pot[];
  players: number;
  count: number
  buyIn: number;
  ended: boolean;
  blindIncreaseMode: BlindIncreaseModes;
  blindIncreaseTime: number;
  blindIncreaseRound: number;
  blindIncreaseMulti: number;
  mode: GameMode;
  payToken: number;
  payTokenName: string;
  payTokenAddress: string;
  payTokenDecimal: number;
}

export enum GameMode {
  TABLE = "TABLE",
  TOURNAMENT = "TOURNAMENT",
}


