import { Card } from "./Card";
import { Action } from "./Action";
import { GameMode } from "./Game";
import { PlayerStreet } from "./Street";
export interface Player {
  id: string;
  gameId: string;
  address: string;
  name?: string;
  pfp: string;
  seatId: number;
  socketId: string;
  cards: Card[];
  stack: number;
  bet: number;
  dealer: boolean;
  smallBlind: boolean;
  bigBlind: boolean;
  active: boolean;
  lastAction: Action | null;
  folded: boolean;
  rewardToken: number | null;
  reward: number;
  createdAt: Date;
  updatedAt: Date;
  mode: GameMode;
  lastStreet: PlayerStreet;
  lastBet: number;
}

export interface PlayerRank {
  address: string;
  name: string;
  pfp: string;
  reward: number;

  gamesWon: number;
  totalGames: number;
  payToken: number;
  payTokenName: string;
  payTokenAddress: string;
  payTokenDecimal: number;
}
