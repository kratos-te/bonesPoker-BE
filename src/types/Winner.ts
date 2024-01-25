import { Card } from "./Card";

export interface Winner {
  playerId: string;
  address: string;
  desc: string;
  prize: number;
  cards: Card[]
}
