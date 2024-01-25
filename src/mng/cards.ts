import { Card } from "../types/Card";
import { Game } from "../types/Game";
import { Street } from "../types/Street";



export function getCommunityCards(game: Game): Card[] {
    const communityCards = game.communityCards;
    switch (game.street) {
        case Street.PREFLOP:
            return [];
        case Street.FLOP:
            return communityCards.slice(0, 3);
        case Street.TURN:
            return communityCards.slice(0, 4);
        case Street.RIVER:
            return communityCards;
    }
}

export function getNextStreet(street: Street): Street {
    switch (street) {
        case Street.PREFLOP:
            return Street.FLOP;
        case Street.FLOP:
            return Street.TURN;
        case Street.TURN:
            return Street.RIVER;
        case Street.RIVER:
            throw new Error("no next street for RIVER");
    }
}
