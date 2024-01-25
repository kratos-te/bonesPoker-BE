
import { AllowedActions } from "src/types/AllowedActions";
import { Card } from "src/types/Card";
import { ActiveGame } from "src/types/Game";
import { RewardPlan } from "src/types/RewardPlan";
import { Token } from "src/types/Token";
import { Tournament, TournamentWinner } from "src/types/Tournament";
import { Seats, TemplateTable, Pot } from "src/types/UI";
import { UserProfile } from "src/types/UserProfile";
import { Winner } from "src/types/Winner";
export interface ServerToClientEvents {

  resitTournamentTable: (gameId: string, countdownStartValue: number) => void;
  seatsUpdated: (seats: Seats, numPlayers: number, allCanOnlyCheck: boolean) => void;
  turnChangedTo: (
    playerId: string | null,
    allowedActions?: AllowedActions
  ) => void;
  gameStarted: () => void;
  potsUpdated: (pots: Pot[]) => void;
  winners: (winners: Winner[] | null, finalFlag: boolean) => void;
  betUpdated: (bet: number) => void;
  communityCardsUpdated: (communityCards: Card[]) => void;
  log: (msg: string, ts: number) => void;
  holeCards: (cards: Card[]) => void;
  bestHand: (hand: string) => void;
  activeGameUpdated: (existingGames: ActiveGame[]) => void;
  gameBlindUpdated: (bigBlindAmount: number) => void;

  activeTournamentUpdated: (existingTournaments: Tournament[]) => void;
  afkGameUpdated: () => void;
  notifyTournamentWinners: (winners: TournamentWinner[]) => void;
  notifyGameLostHands: (winners: Winner[]) => void;
}

export interface ClientToServerEvents {

  updateToken: (
    id: number,
    name: string,
    address: string,
    decimal: number,
    callback: (
      updateResult: boolean, tokenList: Token[]
    ) => void
  ) => Promise<void>;

  deleteTokenIsPossible: (
    name: string,
    address: string,
    callback: (result: boolean) => void
  ) => Promise<void>;

  deleteToken: (
    name: string,
    address: string,
    callback: (
      remvoeResult: boolean, tokenList: Token[]
    ) => void
  ) => Promise<void>;

  addNewToken: (
    name: string,
    address: string,
    decimal: number,
    callback: (addResult: boolean, tokenList: Token[]) => void
  ) => Promise<void>;

  getTokenList: (
    callback: (tokenList: Token[]) => void
  ) => Promise<void>;

  rejoinGameFromAfk: (
    wallet: string,
    gameId: string,
    callback: (myPlayerId: string | null) => void
  ) => Promise<void>;

  getAfkGames: (
    wallet: string,
    callback: (gameIds: ActiveGame[]) => void
  ) => Promise<void>;

  getLeaderboardData: (
    callback: (dailyData: any, monthlyData: any) => void
  ) => Promise<void>;


  getPreviousGameWinners: (
    gameId: string,
    callback: (winners: Winner[] | null, communityCards: Card[] | null) => void
  ) => Promise<void>;

  getExistingTournaments: (
    callback: (activeTournamentList: Tournament[] | null) => void
  ) => Promise<void>;

  saveUserProfileData: (
    address: string,
    userName: string,
    userPfp: string,
    callback: (result: boolean) => void
  ) => Promise<void>;

  getUserProfileData: (
    address: string,
    callback: (userData: UserProfile | null) => void
  ) => Promise<void>;

  getExistingGames: (
    callback: (activeGameList: ActiveGame[] | null) => void
  ) => Promise<void>;
  createGame: (
    tableId: string,
    callback: (gameId: string | null) => void
  ) => Promise<void>;
  sitOnGame: (
    gameId: string,
    txId: string,
    player: string,
    callback: (playerId: string | null, gameStarted?: boolean) => void
  ) => Promise<void>;

  sitTournament: (
    tournamentId: string,
    playerWallet: string,
    txId: string,
    callback: (playerId: string | null, gameId: string | null, gameStarted?: boolean) => void
  ) => Promise<void>;

  isSitOnGame: (
    gameId: string,
    player: string,
    callback: (resultFlag: boolean) => void
  ) => Promise<void>;

  isSitOnTournament: (
    tournamentId: string,
    player: string,
    callback: (result: boolean) => void
  ) => Promise<void>;

  viewTable: (
    gameId: string,
    callback: (
      seats: Seats,
      started: boolean,
      numPlayers: number,
      pots: Pot[],
      winners: Winner[] | null,
      bet: number,
      bigBlindBet: number,
      smallBlindBet: number,
      communityCards: Card[],
      tableName: string,
      initStack: number,
      numSeats: number,
      buyIn: number,
      blindIncreaseMode: string,
      blindIncreaseRound: number,
      blindIncreaseTime: number,
      blindIncreaseMulti: number,
      countdownStartValue: number,
      payToken: Token | null,
      rewardPlan: RewardPlan[] | null
    ) => void
  ) => Promise<void>;

  isTableExist: (
    editInitialStack: number,
    editBuyIn: number,
    editMinBet: number,
    editNumSeats: number,
    payTokenAddress: string,
    callback: (isExist: boolean) => void
  ) => Promise<void>;

  addNewTable: (
    editName: string,
    editNumSeats: number,
    editMinBet: number,
    editInitialStack: number,
    editBuyIn: number,
    blindIncreaseMode: string,
    blindIncreaseRound: number,
    blindIncreaseTime: number,
    tokenId: number,
    callback: (
      tables: TemplateTable[]
    ) => void
  ) => Promise<void>;

  addNewTournament: (

    editName: string,
    editTournamentNumSeats: number,
    editNumSeats: number,
    editMinBet: number,
    editInitialStack: number,
    editBuyIn: number,
    blindIncreaseMode: string,
    blindIncreaseRound: number,
    blindIncreaseTime: number,
    editTournamentEnterAt: Date,
    editTournamentStartAt: Date,
    tokenId: number,
    rewardPlan: RewardPlan[],
    callback: (tournaments: Tournament[]) => void
  ) => Promise<void>;

  deleteTable: (
    id: string,
    editName: string,
    editNumSeats: number,
    editMinBet: number,
    editInitialStack: number,
    editBuyIn: number,
    payTokenId: number,
    callback: (
      tables: TemplateTable[]
    ) => void
  ) => Promise<void>;

  deleteTournament: (
    id: string,
    editName: string,
    editNumSeats: number,
    editMinBet: number,
    editInitialStack: number,
    editBuyIn: number,
    callback: (
      tables: Tournament[]
    ) => void
  ) => Promise<void>;

  startGame: (gameId: string) => Promise<void>;
  call: (gameId: string) => Promise<void>;
  raise: (gameId: string, amount: number) => Promise<void>;
  check: (gameId: string) => Promise<void>;
  fold: (gameId: string) => Promise<void>;
  leave: (gameId: string) => Promise<void>;
  allIn: (gameId: string) => Promise<void>;
  listTables: (callback: (tables: TemplateTable[]) => void) => Promise<void>;
}

export interface InterServerEvents {
  // empty
}

export interface SocketData {
  // empty
}
