import { Card } from "./Card";
import { shuffle } from "../utils/Shuffle";

export class Deck {
  cards: Card[];

  constructor() {
    this.cards = [
      "AS",
      "2S",
      "3S",
      "4S",
      "5S",
      "6S",
      "7S",
      "8S",
      "9S",
      "10S",
      "JS",
      "QS",
      "KS",
      "AH",
      "2H",
      "3H",
      "4H",
      "5H",
      "6H",
      "7H",
      "8H",
      "9H",
      "10H",
      "JH",
      "QH",
      "KH",
      "AC",
      "2C",
      "3C",
      "4C",
      "5C",
      "6C",
      "7C",
      "8C",
      "9C",
      "10C",
      "JC",
      "QC",
      "KC",
      "AD",
      "2D",
      "3D",
      "4D",
      "5D",
      "6D",
      "7D",
      "8D",
      "9D",
      "10D",
      "JD",
      "QD",
      "KD",
    ];
  }

  shuffle(): void {
    shuffle(this.cards);
  }

  draw(): Card {
    const card = this.cards.pop();
    return card!;
  }
}
