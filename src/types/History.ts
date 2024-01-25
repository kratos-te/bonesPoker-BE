import { GameMode } from "./Game";

export interface History {
    id: number,
    wallet: string,
    mode: GameMode,
    entryFee: number,
    reward: number,
    time: Date
}