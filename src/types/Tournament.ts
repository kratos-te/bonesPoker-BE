import { RewardPlan } from "./RewardPlan";
import { BlindIncreaseModes } from "./Table";

export interface Tournament {
    id: string;
    name: string;
    totalSeats: number;
    tableSeats: number;
    initialStack: number;
    minBet: number;
    buyIn: number;
    createdAt: Date | null;
    updatedAt: Date | null;
    enterAt: Date | null;
    startAt: Date | null;
    endAt: Date | null;
    blindIncreaseMode: BlindIncreaseModes;
    blindIncreaseTime: number;
    blindIncreaseRound: number;
    blindIncreaseMulti: number;
    status: TournamentStatus;
    payToken: number;
    payTokenName: string;
    payTokenAddress: string;
    payTokenDecimal: number;
    count: number;
    rewardPlan: RewardPlan[];
    winners: TournamentWinner[];
}

export enum TournamentStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
    RUNNING = "RUNNING",
    ENDED = "ENDED",
}


export interface ActiveTournament {
    id: string;
    name: string;
    totalSeats: number;
    tableSeats: number;
    initialStack: number;
    minBet: number;
    buyIn: number;
    createdAt: Date | null;
    updatedAt: Date | null;
    enterAt: Date | null;
    startAt: Date | null;
    endAt: Date | null;
    blindIncreaseMode: BlindIncreaseModes;
    blindIncreaseTime: number;
    blindIncreaseRound: number;
    blindIncreaseMulti: number;
    status: TournamentStatus;
    payToken: number;
    payTokenName: string;
    payTokenAddress: string;
    payTokenDecimal: number;
    rewardPlan: RewardPlan[];
    winners: TournamentWinner[];
}

export interface TournamentWinner {
    id: string;
    name: string | undefined;
    address: string;
    pfp: string;
    reward: number;
    rank: number;
    payToken: number;
    payTokenName: string;
    payTokenAddress: string;
    payTokenDecimal: number;
}