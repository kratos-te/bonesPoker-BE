import { Action } from "./Action";

export interface ActionHistory {
  gameId: string;
  playerId: string | null;
  socketId: string;
  action: Action;
  amount: number | null;
  bet: number;
  comment: string | null;
}
