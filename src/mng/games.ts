import { ActiveGame, Game, GameMode } from "../types/Game";
import { Player } from "../types/Player";
import { getKnex } from "../knex";
import { chooseNextDealer, getActivePlayers, getActiveUnfoldedPlayers, getActiveUnfoldedPlayersWithCurrentPlayer, getNextPlayer, getPlayerBySocketId, getTournamentPlayersOrderByUpdatedTime, isActiveUnfoldedPlayer, isAllIn, isPlayerTurn, resetPlayers, WinnersMap } from "./players";
//@ts-ignore-next-line
import { Hand } from "pokersolver";
import { Street, PlayerStreet } from "../types/Street";
import { updatePlayer } from './players'
import { Pot } from "../types/Pot";
import { Card } from "../types/Card";
import { Winner } from "../types/Winner";
import { sleep } from "../utils/util";
import { Seats, Pot as UIPot } from "../types/UI";
import { logError } from "../utils/Error";
import { BlindIncreaseModes } from "../types/Table";
import { Deck } from "../types/Deck";
import { sendReward, sendRewardWithToken, sendTournamentReward, sendTournamentRewardWithToken, userLeaveTableOnChain, userLeaveTableWithTokenOnChain, userLeaveTournament, userLeaveTournamentWithToken } from "../context/scripts";
import {
  PublicKey,
} from '@solana/web3.js';
import { Action } from "../types/Action";
import { AllowedActions } from "../types/AllowedActions";
import { getCommunityCards, getNextStreet } from "./cards";
import { recordAction } from "./history";
import { getTable, getTableNameFromId } from "./tables";

import { Server } from "socket.io";

import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../utils/Socketio";
import { AUTO_FOLD_TIME, AUTO_START_TIME, SOL_ADDRESS } from "../context/types";
import { canBeMerged, canMergeOtherTable, getPlayersFromEndedTournament, getTournamentById, isOtherGamesEnded, merge2Game, mergeFromGame, updateTournament } from "./tournaments";
import {
  TournamentStatus, TournamentWinner
} from '../types/Tournament';
import { getTokenById } from "./tokens";
// const TIME_TO_START_NEW_HAND = 6000;
const knex = getKnex();

const FIRST_HAND = 1;



export function isActiveGame(game: Game): boolean {
  return game.startedAt !== null && game.endedAt === null;
}

export const getGameById = async (gameId: string, gameMode: GameMode = GameMode.TABLE): Promise<Game | null> => {
  try {
    let [game] = await knex<Game>("games").select().where({
      id: gameId,
      mode: gameMode,
    });
    if (game) {
      return game;
    } else {
      return null;
    }
  } catch (e) {
    console.log("err on getGameById >> ", e)
    return null;
  }
}

export const getActiveTournamentGames = async (tournamentId: string, started: boolean = false): Promise<Game[]> => {
  try {
    let whereClause = started ? {
      tableId: tournamentId,
      mode: GameMode.TOURNAMENT,
    } : {
      tableId: tournamentId,
      mode: GameMode.TOURNAMENT,
      startedAt: null
    };
    let games = await knex<Game>("games").select().where(whereClause);
    return games;
  } catch (e) {
    console.log("err on getTournamentGames >> ", e)
    return [];
  }
}


export async function updateGame(gameId: string, game: Partial<Game>): Promise<void> {
  const knex = getKnex();
  // TODO: allow to update only specific fields
  await knex<Game>("games").update(game).where({ id: gameId });
}


function createPot(): Pot {
  return {
    total: 0,
    maxBet: 0,
    locked: false,
    playerBets: {},
  };
}


function shuffleDeck(deck: Deck) {
  for (let i = 0; i < 4; ++i) {
    deck.shuffle();
  }
}


export function resetGame(game: Game): void {
  if (game.blindIncreaseMode == BlindIncreaseModes.TIME && new Date().getTime() - new Date(game.updatedAt).getTime() > game.blindIncreaseTime * 60000) {
    game.minBet = game.minBet * game.blindIncreaseMulti;
    game.updatedAt = new Date();
  }


  game.bet = 0;
  game.communityCards = [];
  game.endedAt = null;
  game.hand += 1;
  game.street = Street.PREFLOP;
  game.dealer = null;
  // game.winners = null;
  game.pots = [createPot()];

  if (game.blindIncreaseMode == BlindIncreaseModes.ROUND && game.hand >= game.updatedHand + game.blindIncreaseRound) {
    game.minBet = game.minBet * game.blindIncreaseMulti;
    game.updatedHand = game.hand;
  }
}

export async function startHand(
  game: Game,
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): Promise<void> {
  // 1. reset pot / minBet / minRaise
  // 2. give chips (only in the first hand)
  // 3. deal cards
  // 4. change turn
  log(game.id, "New hand started", io);
  const gameId = game.id;
  const players = await getActiveUnfoldedPlayers(gameId);

  if (players.length == 0) {
    log(game.id, "None players", io);
    return;
  }
  const prevDealer = game.dealer;
  resetGame(game);
  resetPlayers(players);

  const deck = new Deck();
  shuffleDeck(deck);

  if (game.hand === FIRST_HAND) {
    await dealChips(players, game.initialStack);
  }

  const dealerPlayer = await chooseNextDealer(players, game, prevDealer, io);
  game.dealer = dealerPlayer.id;
  // TODO: minBet may be odd, decide how much the small blind will bet
  await paySmallBlind(dealerPlayer, players, game, io);
  await payBigBlind(players, game, io);
  await dealHoleCards(players, deck, io);
  await dealCommunityCards(game, deck);
  // TODO: publish the cards only to the specific player
  await Promise.all(
    players.map(async (player) => {
      await updatePlayer(player.id, {
        // @ts-ignore
        cards: JSON.stringify(player.cards),
        stack: player.stack,
        bet: player.bet,
        dealer: player.dealer,
        bigBlind: player.bigBlind,
        smallBlind: player.smallBlind,
        lastAction: player.lastAction,
        updatedAt: new Date(),
        lastStreet: PlayerStreet.INIT
      });
    })
  );

  // update AFK players to folded
  await Promise.all(players.map(async (player) => {
    if (player.lastAction == Action.AFK) await updatePlayer(player.id, {
      folded: true
    });
  }))

  await updateGame(game.id, {
    currentPlayerId: game.currentPlayerId,
    endedAt: game.endedAt,
    bet: game.bet,
    // @ts-ignore-next-line
    communityCards: JSON.stringify(game.communityCards),
    street: game.street,
    hand: game.hand,
    dealer: game.dealer,
    // @ts-ignore-next-line
    winners: JSON.stringify(game.winners),
    // @ts-ignore-next-line
    pots: JSON.stringify(game.pots),
    minBet: game.minBet,
    updatedAt: game.updatedAt,
    updatedHand: game.updatedHand
  });

  notifyPotsUpdated(game, io);
  const room = getRoomName(game.id);
  io.to(room).emit("gameBlindUpdated", game.minBet);
  notifyGameLostHands([], game.id, io);
  io.to(room).emit("winners", null, false);
  io.to(room).emit("betUpdated", game.bet);
  const communityCards = getCommunityCards(game);
  io.to(room).emit("communityCardsUpdated", communityCards);
  notifyBestHand(players, communityCards, io);
  await notifySeatsUpdated(players, game, io);
  await changeTurn(gameId, io);
}


async function dealHoleCards(
  players: Player[],
  deck: Deck,
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): Promise<void> {
  // TODO: deal cards starting from the player left of the dealer
  players.map(async (player) => {
    player.cards = [deck.draw(), deck.draw()];
    io.to(player.socketId).emit("holeCards", player.cards);
  });
}

async function dealCommunityCards(game: Game, deck: Deck): Promise<void> {
  for (let i = 0; i < 5; ++i) {
    deck.draw(); // burn card
    game.communityCards.push(deck.draw());
  }
}

export async function getGame(id: string): Promise<Game | null> {
  const [game] = await knex<Game>("games").where({
    id,
  });
  return game;
}


export const allCanOnlyCheck = async (game: Game, players: Player[]): Promise<boolean> => {

  let result = true;
  for (let index = 0; index < players.length; index++) {
    const player = players[index];
    let resultForPlayer = await canOnlyCheck(player, game, players);
    console.log("player canonly check >> ", player.address, resultForPlayer)
    if (!resultForPlayer) {
      result = false;
      break;
    }
  }
  return result;
}

export async function canOnlyCheck(nextPlayer: Player, game: Game, players: Player[]): Promise<boolean> {
  // console.log('------------------------------------------------------------------------')
  // console.log("player: ", nextPlayer.id, " >> !cancall : ", !canCall(nextPlayer, game))
  // console.log("player: ", nextPlayer.id, " >> !canRaise : ", !(await canRaise(nextPlayer, game)))
  // console.log("player: ", nextPlayer.id, " >> canCheck : ", canCheck(nextPlayer, game))
  // console.log("========================================================================")

  return (
    !canCall(nextPlayer, game, players) &&
    !(await canRaise(nextPlayer, game, players)) &&
    canCheck(nextPlayer, game)
  );
}

export async function changeTurn(gameId: string, io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>): Promise<void> {
  let game = await getGame(gameId);
  if (!game) return;
  if (!canChangeTurn(game)) {
    return;
  }
  const currentPlayerId = game.currentPlayerId;

  let players = await getActiveUnfoldedPlayers(gameId);
  if (players.length === 1) {
    if (currentPlayerId) {
      await showdown(game, players, io);
    }
    return;
  }



  let players2 = await getActiveUnfoldedPlayersWithCurrentPlayer(gameId, currentPlayerId);

  let nextPlayer = await getNextPlayer(players2, currentPlayerId);
  let nextPlayerId = nextPlayer.id;

  if (currentPlayerId) {
    // TODO: why do we need this condition?
    game.currentPlayerId = nextPlayerId;
    await updateGame(gameId, {
      currentPlayerId: game.currentPlayerId,
    });
  }

  // let lastHistory = await knex.select('id', 'playerId').from('actionHistory').where({ 'gameId': gameId }).orderBy('id', 'desc').limit(2);
  let allCanOnlyCheckResult = await allCanOnlyCheck(game, players);
  if (allCanOnlyCheckResult) {

  } else {

  }

  if (await canOnlyCheck(nextPlayer, game, players)) {

    allCanOnlyCheckResult = await allCanOnlyCheck(game, players);
    console.log(">>>>>>> allCanOnlyCheckResult : ", allCanOnlyCheckResult)
    if (allCanOnlyCheckResult) {

      await showdown(game, players, io, true);
      return;
    } else {

      if (isStreetOver(players, game)) {
        if (game.street === Street.RIVER) {
          await showdown(game, players, io);
          return;
        } else {
          await startNextStreet(game, players, io);

          game = await getGame(game.id);
          players2 = await getActiveUnfoldedPlayersWithCurrentPlayer(gameId, currentPlayerId);
          nextPlayer = await getNextPlayer(players2, currentPlayerId);
          if (!game) {
            return;
          }
          await sleep(3000);
          await notifySeatsUpdated(players, game, io, false, false);
          // await sleep(2000)
          await notifyTurnChangedTo(nextPlayer, game, io);
          // await check(gameId, nextPlayer.socketId, io);
        }
      } else {
        game = await getGame(game.id);
        players2 = await getActiveUnfoldedPlayersWithCurrentPlayer(gameId, currentPlayerId);
        nextPlayer = await getNextPlayer(players2, currentPlayerId);

        await sleep(2000)
        await check(gameId, nextPlayer.socketId, io);
      }

    }
  } else {
    if (isStreetOver(players, game)) {
      if (game.street === Street.RIVER) {
        await showdown(game, players, io);
        return;
      } else {
        await startNextStreet(game, players, io);

        game = await getGame(game.id);
        players2 = await getActiveUnfoldedPlayersWithCurrentPlayer(gameId, currentPlayerId);
        nextPlayer = await getNextPlayer(players2, currentPlayerId);

        if (!game) {
          return;
        }
        await sleep(3000);

        await notifySeatsUpdated(players, game, io, false, false);

        await notifyTurnChangedTo(nextPlayer, game, io);
      }
    } else {
      game = await getGame(game.id);
      players2 = await getActiveUnfoldedPlayersWithCurrentPlayer(gameId, currentPlayerId);
      nextPlayer = await getNextPlayer(players2, currentPlayerId);

      if (!game) {
        return;
      }
      await notifyTurnChangedTo(nextPlayer, game, io);
    }
  }

  // if (!nonloop) {
  let prevHistoryIds = await knex.select('id').from('actionHistory').where({ 'gameId': gameId, 'playerId': currentPlayerId }).orderBy('id', 'desc').limit(1);
  // return;
  // console.log("currentPlayerId >>", currentPlayerId)
  // console.log("nextplayerid >> ", nextPlayerId)
  setTimeout(async () => {

    let nextGame = await getGame(gameId);
    if (!nextGame) return;
    if (!canChangeTurn(nextGame)) {
      return;
    }
    // return;
    // let newNextPlayerIdTmp = nextGame.currentPlayerId;
    let newNextHistoryIds = await knex.select('id').from('actionHistory').where({ 'gameId': gameId }).orderBy('id', 'desc').limit(1);
    // , 'playerId': newNextPlayerIdTmp 

    if (newNextHistoryIds.length == 0 && prevHistoryIds.length == 0 || newNextHistoryIds.length > 0 && prevHistoryIds.length > 0 && prevHistoryIds[0].id >= newNextHistoryIds[0].id) {
      // console.log("leave", nextPlayer.id);
      fold(gameId, io, undefined, nextPlayer);
    }

    // console.log(currentPlayerId, nextPlayerId, nextPlayerIdTmp);
    // if (nextPlayerId == newNextPlayerIdTmp) {
    //   await leave(gameId, undefined, nextPlayer);
    // }
  }, AUTO_FOLD_TIME);
  // }
}


export async function insertGame(args: Partial<Game>): Promise<Game> {
  const [game] = await knex<Game>("games").insert(
    {
      ...args,
    },
    "*"
  );
  return game;
}

export function isStreetOver(players: Player[], game: Game): boolean {
  for (const player of players) {
    if (player.lastAction === null) {
      return false;
    }
    if (player.bet < game.bet && player.stack > 0) {
      return false;
    }
  }
  return true
  // console.log("isStreetOver : ", players, game);

  // let result = true;
  // for (const player of players) {
  //   if (player.lastStreet != (game.street as unknown as PlayerStreet) || player.bet < game.bet && player.stack > 0) {
  //     result = false;
  //   }
  // }
  // return result;

}

export async function showdown(game: Game, players: Player[], io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>, instantShow?: boolean): Promise<void> {
  try {
    // await turn2FinalStreet(game, players);
    await notifySeatsUpdated(players, game, io, true, true);
    await sleep(2000);
    notifyPotsUpdated(game, io);

    let prevTurnCommunityCardsLength = 0;

    if (game.street == Street.PREFLOP) {
      prevTurnCommunityCardsLength = 0;
    } else if (game.street == Street.FLOP) {
      prevTurnCommunityCardsLength = 3;
    } else if (game.street == Street.TURN) {
      prevTurnCommunityCardsLength = 4;
    } else if (game.street == Street.RIVER) {
      prevTurnCommunityCardsLength = 5;
    }


    if (instantShow) {
      game.street = Street.RIVER;

      game.bet = 0;
      await updateGame(game.id, {
        street: game.street,
        bet: game.bet,
        // @ts-ignore-next-line
        pots: JSON.stringify(game.pots),
      });
      for (const player of players) {
        player.lastAction = null;
        player.bet = 0;
        await updatePlayer(player.id, {
          bet: player.bet,
          lastAction: player.lastAction,
          updatedAt: new Date()
        });
      }

      log(game.id, `Moving to ${game.street}`, io);

    }

    const communityCards = getCommunityCards(game);
    console.log("showdowning ... ")
    const gameId = game.id;
    let activePlayers = await getActivePlayers(game.id);
    // updatePots(game, players);
    // const prize = getPrize(game, players);
    const pots = game.pots;
    const winnersMap: WinnersMap = {};
    for (const pot of pots) {
      await updatePotWins(game, winnersMap, players, pot);
    }
    console.log("winners map ", winnersMap)

    // console.log("winnersMap after returned >> ", winnersMap);

    let lostPlayers: Winner[] = []
    for (const player of players) {
      player.bet = 0;
      if (player.id in winnersMap) {
        const winner = winnersMap[player.id];
        player.stack += winner.prize;
        setTimeout(() => {
          log(
            gameId,
            `${winner.playerId} wins ${winner.prize} with ${winner.desc}!`,
            io
          );
        }, 4000);
      } else if (player.active && !player.folded) {

        const cards = [...player.cards, ...communityCards];
        const bestHand = Hand.solve(getSolverCards(cards));
        lostPlayers.push({
          playerId: player.id,
          desc: bestHand.descr,
          prize: 0,
          address: player.address,
          cards: player.cards
        })
      }
      await updatePlayer(player.id, {
        stack: player.stack,
        bet: player.bet,
        updatedAt: new Date()
      });
    }




    const winners = Object.values(winnersMap).reduce((acc: Winner[], w) => {
      acc.push(w);
      return acc;
    }, []);
    const room = getRoomName(gameId);


    game.endedAt = new Date();
    game.currentPlayerId = null;
    game.winners = winners;
    let communityCardsLength = 0;
    if (game.street == Street.PREFLOP) {
      communityCardsLength = 0;
    } else if (game.street == Street.FLOP) {
      communityCardsLength = 3;
    } else if (game.street == Street.TURN) {
      communityCardsLength = 4;
    } else if (game.street == Street.RIVER) {
      communityCardsLength = 5;
    }
    game.prevCommunityCards = game.communityCards.slice(0, communityCardsLength);

    await updateGame(game.id, {
      currentPlayerId: game.currentPlayerId,
      endedAt: game.endedAt,
      //@ts-ignore-next-line
      winners: JSON.stringify(game.winners),
      //@ts-ignore-next-line
      prevCommunityCards: JSON.stringify(game.prevCommunityCards),
    });


    // setTimeout(async () => {
    //   await notifySeatsUpdated(players, game, io, true, true);
    // }, 4000);

    await notifyTurnChangedTo(null, game, io);
    activePlayers = await getActivePlayers(game.id);
    await endHand(activePlayers, game, io);
    activePlayers = await getActivePlayers(game.id);

    // let finalFlag = activePlayers.filter(player => player && player && !player.folded && (player.stack && player.stack > 0 || player.bet && player.bet > 0)).length <= 1;
    let finalFlag = activePlayers.length <= 1;

    let totalBettedPlayers = await knex.raw(`
    select * from players where "gameId" = '${gameId}' and "seatId" != 0 
    `)
    let totalWinnedVault = game.buyIn * activePlayers[0].stack / game.initialStack;
    let leaveVault = game.buyIn * totalBettedPlayers.rows.length - totalWinnedVault;
    if (finalFlag && game.mode == GameMode.TABLE) {
      console.log("sending reward...")

      game.ended = true;
      await updateGame(game.id, {
        ended: game.ended,
      });

      let payToken = await getTokenById(game.payToken);
      if (payToken?.address == SOL_ADDRESS) {
        sendReward(
          new PublicKey(winners[0].address),
          totalWinnedVault,
          leaveVault
        );
        await updatePlayer(winners[0].playerId, {
          reward: totalWinnedVault,
          rewardToken: payToken.id,
        })

      } else if (payToken?.address) {
        sendRewardWithToken(new PublicKey(winners[0].address),
          totalWinnedVault,
          leaveVault, new PublicKey(payToken?.address))

        await updatePlayer(winners[0].playerId, {
          reward: totalWinnedVault,
          rewardToken: payToken.id,
        })
      }

      io.emit("afkGameUpdated");

    }


    setTimeout(async () => {
      io.to(room).emit("communityCardsUpdated", communityCards);
      // await notifySeatsUpdated(players, game, io, true, true);
    }, 500)


    console.log("returned winners ", winners);

    setTimeout(async () => {
      io.to(room).emit("winners", winners, finalFlag && game.mode == GameMode.TABLE);
      notifyGameLostHands(lostPlayers, game.id, io);
      notifyBestHand(players, communityCards, io);
      io.to(room).emit("betUpdated", game.bet);
      // notifyPotsUpdated(game, io);
      // await sleep(2000)
      // await notifySeatsUpdated(players, game, io, true, true);
    }, 500 + (5 - prevTurnCommunityCardsLength) * 500);

    let canBeMergedResult = await canBeMerged(game);
    console.log("canBeMergedResult >> ", canBeMergedResult);



    if (game.numSeats > activePlayers.length && game.mode == GameMode.TOURNAMENT && canBeMergedResult) {
      console.log("merge to game >> ")
      setTimeout(async () => {
        if (canBeMergedResult) await merge2Game(game, canBeMergedResult, io);
      }, 3000);
      return;

    } else if (game.numSeats > activePlayers.length && game.mode == GameMode.TOURNAMENT) {

      let canMergeOtherTableResult = await canMergeOtherTable(game);
      console.log("current game >> ", game.id);
      console.log("canMergeOtherTableResult >> ", canMergeOtherTableResult)
      if (canMergeOtherTableResult) {
        await mergeFromGame(game, canMergeOtherTableResult, io);
      } else {
        console.log(">>> ", activePlayers.length, (await isOtherGamesEnded(game)));

        if (activePlayers.length == 1 && (await isOtherGamesEnded(game))) {
          let tournament = await getTournamentById(game.tableId);
          if (!tournament) return;
          await updateTournament(game.tableId, {
            endAt: new Date(),
            status: TournamentStatus.ENDED
          });

          // get tournament winners with ranking
          let rewardPlan = tournament.rewardPlan;

          let tournamentWinners: Player[] = [];
          let tmp = players.filter((player, _index) => player.address == winners[0].address);
          tournamentWinners.push(tmp[0]);

          let remainingPlayers = players.filter((player, _index) => player.address !== winners[0].address)

          if (remainingPlayers.length >= rewardPlan.length - 1) {
            if (remainingPlayers.length == 1) {
              tournamentWinners.push(remainingPlayers[0])
            } else {
              let result = await getWinnersOnTournaments(remainingPlayers, game);
              tournamentWinners = [...tournamentWinners, ...result].slice(0, rewardPlan.length - 1);
            }
          } else {
            let result = await getWinnersOnTournaments(remainingPlayers, game);
            tournamentWinners = [...tournamentWinners, ...result];

            let remainedPlayersLength = rewardPlan.length - tournamentWinners.length;
            let tmp = await getTournamentPlayersOrderByUpdatedTime(game.tableId, tournamentWinners, remainedPlayersLength);
            tournamentWinners = [...tournamentWinners, ...tmp];
          }

          // if (players.length==2 && rewardPlan.length>=2) {
          //   for (let player of players) {
          //     if (player.address !== winners[0].address) {
          //       tournamentWinners.push(player.address)
          //     }
          //   }
          //   let remainningWinnersLength = rewardPlan.length - 2;
          //   if (remainningWinnersLength>0) {
          //     // let gamePlayers = await getGamePlayersByGameIdOrderByUpdatedTime(game.id)
          //     for(let i=0;i<gamePlayers.length;i++) {
          //       let gamePlayer = gamePlayers[i];
          //       if (!tournamentWinners.includes(gamePlayer.address) && (gamePlayers[i+1] && new Date(gamePlayers[i].updatedAt).getTime() != new Date(gamePlayers[i].updatedAt).getTime() || !gamePlayers[i+1])) {
          // tournamentWinners.push(gamePlayer.address);
          //       } else {

          //       }
          //     }
          //   }
          // }else if (players.length >= rewardPlan.length && players.length> 2) {

          // } 

          let tournamentPlayers = await getPlayersFromEndedTournament(game.tableId);
          let activeTournamentPlayersLength = tournamentPlayers.filter((player, _index) => player.seatId != 0).length;
          console.log("tournamentPlayers ", tournamentPlayers.length, tournamentPlayers)
          console.log("activeTournamentPlayersLength", activeTournamentPlayersLength);

          let rewardPlan4Tx: number[] = [];
          for (let plan of rewardPlan) {
            rewardPlan4Tx.push(plan.percent * 100)
          }
          let tournamentWinners4Tx: string[] = [];
          for (let winner of tournamentWinners) {
            tournamentWinners4Tx.push(winner.address);
          }

          // previous works from here
          totalWinnedVault = tournament.buyIn * activeTournamentPlayersLength;
          let payToken = await getTokenById(tournament.payToken);
          console.log("tournamentWinners4Tx ", tournamentWinners4Tx);

          if (payToken?.address == SOL_ADDRESS) {
            // sendReward(
            //   new PublicKey(winners[0].address),
            //   totalWinnedVault,
            //   0
            // );
            sendTournamentReward(totalWinnedVault, tournament.initialStack, tournament.buyIn, tournament.minBet, tournament.totalSeats, rewardPlan4Tx, tournamentWinners4Tx);

            for (let i = 0; i < tournamentWinners.length; i++) {
              let tournamentWinner = tournamentWinners[i];
              let reward = rewardPlan[i].percent * totalWinnedVault / 100
              await updatePlayer(tournamentWinner.id, {
                reward: reward,
                rewardToken: payToken.id,
              })

            }


          } else if (payToken?.address) {
            // sendRewardWithToken(new PublicKey(winners[0].address),
            //   totalWinnedVault,
            //   0,
            //   new PublicKey(payToken.address))
            sendTournamentRewardWithToken(totalWinnedVault, tournament.initialStack, tournament.buyIn, tournament.minBet, tournament.totalSeats, rewardPlan4Tx, tournamentWinners4Tx, new PublicKey(payToken.address));

            for (let i = 0; i < tournamentWinners.length; i++) {
              let tournamentWinner = tournamentWinners[i];
              let reward = rewardPlan[i].percent * totalWinnedVault / 100
              await updatePlayer(tournamentWinner.id, {
                reward: reward,
                rewardToken: payToken.id,
              })

            }
          }

          let tournamentWinners4DB: TournamentWinner[] = [];
          if (payToken) {

            for (let i = 0; i < tournamentWinners.length; i++) {
              let tournamentWinner = tournamentWinners[i]
              tournamentWinners4DB.push({
                id: tournamentWinner.id,
                name: tournamentWinner.name,
                address: tournamentWinner.address,
                pfp: tournamentWinner.pfp,
                reward: rewardPlan[i].percent * totalWinnedVault / 100,
                rank: i + 1,
                payToken: payToken.id,
                payTokenAddress: payToken.address,
                payTokenName: payToken.name,
                payTokenDecimal: payToken.decimal,
              });
            }
          }

          // @ts-ignore-next-line
          await updateTournament(game.tableId, { winners: JSON.stringify(tournamentWinners4DB) });
          io.to(room).emit("notifyTournamentWinners", tournamentWinners4DB);

        }
      }
    }

    // if (activePlayers.length > 1) {
    setTimeout(async () => {

      activePlayers = await getActivePlayers(game.id);
      // activePlayers = await getActivePlayers(gameId);
      console.log("active players >> ", activePlayers.length)
      if (activePlayers.length > 1) {


        await startHand(game, io);
      } else {

        await notifySeatsUpdated(players, game, io, true);

      }
    }, 3000 + (5 - prevTurnCommunityCardsLength) * 500);
    // }
  } catch (e) {
    console.log(e)
  }
}



export async function notifyTurnChangedTo(
  player: Player | null,
  game: Game,
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): Promise<void> {
  const room = getRoomName(game.id);
  if (!player) {
    io.to(room).emit("turnChangedTo", null);
  } else {
    const allowedActions = await getAllowedActions(player, game);
    io.to(room).emit("turnChangedTo", player.id, allowedActions);
  }
}

export function notifyPotsUpdated(
  game: Game,
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): void {
  const room = getRoomName(game.id);
  const pots: UIPot[] = game.pots.map((p) => {
    return { total: p.total };
  });
  // console.log("game pots: ", game.pots);
  io.to(room).emit("potsUpdated", pots);
}


export async function notifySeatsUpdated(
  players: Player[],
  game: Game,
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  finalFlag?: boolean,
  allCanOnlyCheck?: boolean,
): Promise<void> {

  let allAreFolded = true;

  let winnerPlayerIds = [];
  if (game.winners) {
    for (let i = 0; i < game.winners?.length; i++) {
      winnerPlayerIds.push(game.winners[i].playerId);
    }
    if (players.length > winnerPlayerIds.length) {
      for (let i = 0; i < players.length; i++) {
        if (!players[i].folded && !winnerPlayerIds.includes(players[i].id)) {
          allAreFolded = false;
          break;
        }
      }

    } else {
      allAreFolded = true;
    }
  } else {
    let activeUnfoldedPlayers = await getActiveUnfoldedPlayers(game.id);
    if (players.length == 1 || activeUnfoldedPlayers.length == 1) {
      allAreFolded = true
    } else {
      allAreFolded = false;
    }
  }

  const seats = await getSeats(game, finalFlag, allAreFolded);
  console.log("seats ", seats)
  const room = getRoomName(game.id);
  // TODO: publish the cards only to the specific player
  io.to(room).emit("seatsUpdated", seats, players.length, allCanOnlyCheck ? true : false);
}

export const notifyGameLostHands = async (
  lostPlayers: Winner[],
  gameId: string,
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
) => {
  const room = getRoomName(gameId);
  io.to(room).emit("notifyGameLostHands", lostPlayers);
}

export function notifyBestHand(
  players: Player[],
  communityCards: Card[],
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): void {
  for (const player of players) {
    const cards = [...player.cards, ...communityCards];
    const bestHand = Hand.solve(getSolverCards(cards));
    io.to(player.socketId).emit("bestHand", bestHand.descr);
  }
}


export async function updatePotWins(
  game: Game,
  winnersMap: WinnersMap,
  players: Player[],
  pot: Pot
): Promise<void> {
  const prize = pot.total;
  const potPlayers = players.filter((p) =>
    Object.keys(pot.playerBets).includes(p.id)
  );

  // console.log("pot players >> ", potPlayers);

  const potWinners = await getWinners(potPlayers, game, prize);

  // console.log("pot winners >> ", potWinners);

  for (const potWinner of potWinners) {
    const playerId = potWinner.playerId;
    const winner = winnersMap[playerId];
    if (!winner) {
      winnersMap[playerId] = {
        playerId,
        address: potWinner.address,
        prize: potWinner.prize,
        desc: potWinner.desc,
        cards: potWinner.cards
      };
    } else {
      winnersMap[playerId].prize += potWinner.prize;
    }
  }
  // console.log("winners map before returned >> ", winnersMap);
}

export async function getWinners(
  players: Player[],
  game: Game,
  prize: number
): Promise<Winner[]> {
  let winners: Winner[] = [];
  const returnedWinners: Winner[] = [];

  // if (players.length === 1) {
  //   winners.push({
  //     playerId: players[0].id,
  //     desc: "last player",
  //     prize,
  //   });
  //   return winners;
  // }
  let communityCardsLength = game.street == Street.PREFLOP ? 0 : game.street == Street.FLOP ? 3 : game.street == Street.TURN ? 4 : game.street == Street.RIVER ? 5 : 0;
  let communityCards = game.communityCards.slice(0, communityCardsLength);
  const playerCards = players.map((p) =>
    Hand.solve(getSolverCards([...p.cards, ...communityCards]))
  );
  let winnersSet = new Set(Hand.winners(playerCards));

  // TODO: support uneven split of the prize
  // i.e. if (prize % winnersSet.size !== 0)
  const prizeShare = Math.floor(prize / winnersSet.size);
  // let lastPlayerFlag = true;
  for (let i = 0; i < players.length; ++i) {
    const player = players[i];
    const cards = playerCards[i];
    if (winnersSet.has(cards)) {

      // winners.push({
      //   playerId: player.id,
      //   desc: cards.descr,
      //   prize: prizeShare,
      // });
    } else {
      if (player.stack != 0) {
        // lastPlayerFlag = false;
      }
    }
  }

  // if (lastPlayerFlag == true && winnersSet.size == 1) {
  let winnerPlayerIds = [];
  for (let i = 0; i < players.length; ++i) {
    const player = players[i];
    const cards = playerCards[i];
    if (winnersSet.has(cards)) {
      winnerPlayerIds.push(player.id);
      winners.push({
        playerId: player.id,
        desc: cards.descr,
        prize: prizeShare,
        address: player.address,
        cards: player.cards
      });
    }
  }

  // if (winners.length > 1) {
  //   let winnerCards: string[][] = [];
  //   for (let winner of winners) {

  //     winnerCards.push([winner.cards[0].slice(0, -1) + "s", winner.cards[1].slice(0, -1) + "s"])
  //   }

  //   let commonCards = winnerCards.shift()?.filter(function (v) {
  //     return winnerCards.every(function (a) {
  //       return a.indexOf(v) !== -1;
  //     });
  //   });
  //   if (commonCards != undefined && commonCards.length < 2) {
  //     // let winnerCards2: string[][] = [];
  //     let tmpWinners: Winner[] = winners;

  //     for (let i = 0; i < tmpWinners.length; i++) {
  //       tmpWinners[i].cards = [tmpWinners[i].cards[0].slice(0, -1) + "s", tmpWinners[i].cards[1].slice(0, -1) + "s"].filter(card => commonCards != undefined && !commonCards.includes(card))

  //     }

  //     let playerCards2 = tmpWinners.map((w) => Hand.solve(getSolverCards(w.cards)))
  //     let winnersSet2 = new Set(Hand.winners(playerCards2));
  //     if (winnersSet2.size == 1) {
  //       let tmpWinners2: Winner[] = []
  //       for (let i = 0; i < tmpWinners.length; i++) {
  //         if (winnersSet2.has(playerCards2[i])) {
  //           tmpWinners2.push(winners[i])
  //         }
  //       }
  //       winners = tmpWinners2;
  //     }

  //   }

  // }
  console.log("community cards ", game.communityCards)
  console.log("calculated winners ", winners)
  // return winners
  let allAreFolded = true;
  if (winners) {
    let activeplayers = await getActivePlayers(game.id);
    if (activeplayers.length > winners.length) {
      for (let i = 0; i < activeplayers.length; i++) {
        if (!activeplayers[i].folded && !winnerPlayerIds.includes(activeplayers[i].id)) {
          allAreFolded = false;
          break;
        }
      }
    } else if (activeplayers.length == winners.length && winners.length > 1) {
      allAreFolded = false;
    } else {
      allAreFolded = true;
    }
  }
  if (allAreFolded) {
    for (let winner of winners) {
      returnedWinners.push({
        playerId: winner.playerId,
        desc: "",
        prize: winner.prize,
        address: winner.address,
        cards: winner.cards
      })
    }
  } else {
    return winners;
  }
  // } else {
  //   for (let i = 0; i < players.length; ++i) {
  //     const player = players[i];
  //     const cards = playerCards[i];
  //     if (winnersSet.has(cards)) {
  //       winners.push({
  //         playerId: player.id,
  //         desc: cards.descr,
  //         prize: prizeShare,
  //       });
  //     }
  //   }
  // }
  return returnedWinners;
}

export async function getSeats(game: Game, finalFlag?: boolean, allAreFolded?: boolean): Promise<Seats> {
  // console.log(finalFlag)
  const players = await getActivePlayers(game.id);
  const seats: Seats = {};
  try {
    for (let i = 1; i < game.numSeats + 1; ++i) {
      seats[i] = null;
    }
    for (const player of players) {
      if (!player.cards) continue;
      if (finalFlag && !allAreFolded) {
        seats[player.seatId] = {
          id: player.id,
          cards: player.cards,
          stack: player.stack,
          bet: player.bet,
          dealer: player.dealer,
          smallBlind: player.smallBlind,
          bigBlind: player.bigBlind,
          lastAction: player.lastAction,
          folded: player.folded,
          address: player.address,
          name: player.name,
          pfp: player.pfp,
          lastBet: player.lastBet
        };
      } else {
        seats[player.seatId] = {
          id: player.id,
          cards: [],
          stack: player.stack,
          bet: player.bet,
          dealer: player.dealer,
          smallBlind: player.smallBlind,
          bigBlind: player.bigBlind,
          lastAction: player.lastAction,
          folded: player.folded,
          address: player.address,
          name: player.name,
          pfp: player.pfp,
          lastBet: player.lastBet
        };
      }
    }
  } catch (e) {
    logError("table", e);
  }
  return seats;
}

export function getSolverCards(cards: Card[]) {
  return cards.map((card) => {
    if (card.length === 3) {
      return "T" + card[2];
    } else {
      return card;
    }
  });
}


export function log(gameId: string, msg: string, io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
  const room = getRoomName(gameId);
  io.to(room).emit("log", msg, Date.now());
}

export function getRoomName(gameId: string): string {
  return `game:${gameId}`;
}


export async function dealChips(
  players: Player[],
  initialStack: number
): Promise<void> {
  await Promise.all(
    players.map(async (player) => {
      player.stack = initialStack;
      await updatePlayer(player.id, {
        stack: player.stack,
        updatedAt: new Date()
      });
    })
  );
}


export async function canRaise(
  player: Player,
  game: Game,
  players: Player[],
  amount?: number
): Promise<boolean> {
  const minRaise = getMinRaise(player, game);
  if (amount === undefined) {
    amount = minRaise;
  }
  const maxRaise = await getMaxBet(player, game);
  let stackPlayersLength = players.filter((player) => player.stack > 0).length;//+ player.bet 
  // console.log("minraise >>", minRaise, " amount>>", amount, "maxraise>>", maxRaise, " player stack>>", player.stack, " player bet>>", player.bet)
  return (
    isActiveGame(game) &&
    // isPlayerTurn(player, game) &&
    isActiveUnfoldedPlayer(player) &&
    minRaise <= amount &&
    amount <= maxRaise &&
    amount <= player.stack &&
    stackPlayersLength > 1 &&
    player.stack > 0
    // (history.length <= 1 || history[1].playerId != player.id)
  );
}

export function getCallAmount(player: Player, game: Game): number {
  if (game.bet != 0) return Math.min(game.bet - player.bet, player.stack);
  else return 0; //Math.min(game.minBet, player.stack);
}


export async function getMaxBet(player: Player, game: Game): Promise<number> {
  console.log(game.bet)
  // const players = await getActiveUnfoldedPlayers(game.id);
  // const maxOthersCanBet = players.reduce((acc: number, p: Player) => {

  //   if (p.id !== player.id && p.bet + p.stack > 0 && p.stack > 0) {
  //     acc = Math.min(acc, p.bet + p.stack);
  //   }
  //   return acc;
  // }, 9000);

  return player.stack//Math.min(player.stack, maxOthersCanBet - player.bet);
}


export function getMinRaise(player: Player, game: Game): number {
  const callAmount = getCallAmount(player, game);
  return Math.min(callAmount + getBigBlindBet(game), player.stack);
}


export function canCall(player: Player, game: Game, players: Player[]): boolean {
  // console.log("player : ", player.id, " playerstack:", player.stack, " playerbet:", player.bet, " gamebet:", game.bet, " ");
  let stackPlayersLength = players.filter((player) => player.stack + player.bet > 0).length;
  // console.log(" >> ",
  //   game.bet,
  //   isActiveGame(game),
  //   isPlayerTurn(player, game),
  //   isActiveUnfoldedPlayer(player),
  //   player.stack > 0,
  //   player.bet < game.bet,
  //   getCallAmount(player, game) < player.stack,
  //   stackPlayersLength
  // )

  if (game.bet != 0) return (
    isActiveGame(game) &&
    // isPlayerTurn(player, game) &&
    isActiveUnfoldedPlayer(player) &&
    player.stack > 0 &&
    player.bet < game.bet &&
    // getCallAmount(player, game) < player.stack &&
    stackPlayersLength > 1
    // (history.length <= 1 || history.length > 1 && history[1].playerId != player.id)
  );
  else return (
    isActiveGame(game) &&
    isPlayerTurn(player, game) &&
    isActiveUnfoldedPlayer(player) &&
    player.stack > 0 &&
    stackPlayersLength > 1 &&
    false
    // (history.length <= 1 || history.length > 1 && history[1].playerId != player.id)
  );
}


async function getAllowedActions(
  player: Player | null,
  game: Game
): Promise<AllowedActions> {
  const allowedActions: AllowedActions = {
    actions: {},
    params: {
      minRaise: 0,
      maxBet: 0,
      callAmount: 0,
    },
  };
  if (!player) {
    return allowedActions;
  }
  allowedActions.params.maxBet = await getMaxBet(player, game);

  let players = await getActiveUnfoldedPlayers(game.id);
  // let lastHistory = await knex.select('id', 'playerId').from('actionHistory').where({ 'gameId': game.id }).orderBy('id', 'desc').limit(2);

  for (const action of Object.keys(Action)) {
    switch (action) {
      case Action.CALL:
        allowedActions.actions[action] = canCall(player, game, players);
        allowedActions.params.callAmount = getCallAmount(player, game);
        break;
      case Action.RAISE:
        const flag = await canRaise(player, game, players);
        if (flag) {
          allowedActions.params.minRaise = getMinRaise(player, game);
        }
        allowedActions.actions[action] = flag;
        break;
      case Action.CHECK:
        allowedActions.actions[action] = canCheck(player, game);
        break;
      case Action.FOLD:
        allowedActions.actions[action] = canFold(player, game);
        break;
      case Action.AFK:
        allowedActions.actions[action] = canFold(player, game);
        break;
      case Action.ALL_IN:
        allowedActions.actions[action] = canAllIn(player, game, players);
        break;
    }
  }
  return allowedActions;
}


export function getBigBlindBet(game: Game): number {
  return game.minBet;
}

export function getSmallBlindBet(game: Game): number {
  return game.minBet / 2;
}

export function canCheck(player: Player, game: Game): boolean {
  // console.log("player, ", player);
  // console.log("isActiveUnfoldedPlayer, ", isActiveUnfoldedPlayer(player));

  return (
    isActiveGame(game) &&
    // isPlayerTurn(player, game) &&
    isActiveUnfoldedPlayer(player) &&
    (isAllIn(player) || player.bet === game.bet)
  );
}


export function canFold(player: Player, game: Game): boolean {
  return (
    isActiveGame(game) &&
    isPlayerTurn(player, game) &&
    isActiveUnfoldedPlayer(player)
  );
}


export function canAllIn(player: Player, game: Game, players: Player[]): boolean {
  let stackPlayersLength = players.filter((player) => player.stack + player.bet > 0).length;
  return (
    isActiveGame(game) &&
    isPlayerTurn(player, game) &&
    isActiveUnfoldedPlayer(player) &&
    player.stack > 0 &&
    // (history.length <= 1 || history[1].playerId != player.id)
    stackPlayersLength > 1

  );
}


export function updatePotsAfterBet(game: Game, playerId: string, bet: number, allIn?: boolean): void {
  // let i = 0;
  for (let pot of game.pots) {
    // console.log("------------------------------------")
    // console.log("game pots >> ", game.pots)

    // console.log("pot > ", pot);
    // console.log("bet >> ", bet);
    // console.log("i >>> ", i);
    // console.log("========================================")
    // const pot = game.pots[i];

    const currentBet = pot.playerBets[playerId] ?? 0;
    if (!pot.locked && bet > 0) {
      if (allIn) {
        // game.pots[i].locked = true;
        pot.locked = true;
        let newPot = createPot()

        let currPotNewBet = currentBet + bet;
        let currPotNewTotal = 0;
        pot.playerBets[playerId] = currPotNewBet;

        for (let player_Id in pot.playerBets) {

          if (pot.playerBets[player_Id] > currPotNewBet) {
            // game.pots[i + 1]
            newPot.playerBets[player_Id] = pot.playerBets[player_Id] - currPotNewBet;
            newPot.total += pot.playerBets[player_Id] - currPotNewBet;
            newPot.maxBet = Math.max(pot.playerBets[player_Id] - currPotNewBet, newPot.maxBet)
            pot.playerBets[player_Id] = currPotNewBet;
          }
          currPotNewTotal += pot.playerBets[player_Id];

        }
        pot.maxBet = currPotNewBet;
        pot.total = currPotNewTotal;
        bet = 0;
        game.pots.push(newPot);
      } else {
        const newBet = currentBet + bet;
        pot.playerBets[playerId] = newBet;
        pot.maxBet = Math.max(pot.maxBet, newBet);
        pot.total += bet;
        bet = 0;

      }
      break;

    } else if (pot.locked && bet > 0) {
      if (allIn) {
        if (pot.maxBet == currentBet + bet) {
          pot.playerBets[playerId] = currentBet + bet;
          pot.total += bet;
          bet = 0;
        } else if (pot.maxBet > currentBet + bet) {

          let newPot = createPot()
          // console.log("++++++++++++++++++++++++++++++++++++")
          // console.log(game.pots, i)
          // console.log("++++++++++++++++++++++++++++++++++++")


          newPot.locked = true;

          pot.maxBet = currentBet + bet;
          pot.playerBets[playerId] = pot.maxBet;

          let currPotNewTotal = 0;
          for (let player_Id in pot.playerBets) {
            if (pot.playerBets[player_Id] > pot.maxBet) {
              // game.pots[game.pots.length - 1]
              newPot.playerBets[player_Id] = pot.playerBets[player_Id] - pot.maxBet;
              newPot.maxBet = Math.max(newPot.maxBet, pot.playerBets[player_Id] - pot.maxBet);
              newPot.total += pot.playerBets[player_Id] - pot.maxBet;
              pot.playerBets[player_Id] = pot.maxBet;
            }
            currPotNewTotal += pot.playerBets[player_Id];
          }
          pot.total = currPotNewTotal;
          bet = 0;
          game.pots.splice(1, 0, newPot);
        } else {
          pot.playerBets[playerId] = pot.maxBet;
          pot.total += (pot.maxBet - currentBet);
          bet -= (pot.maxBet - currentBet);
        }
      } else {
        if (currentBet < pot.maxBet && bet + currentBet >= pot.maxBet) {
          const diff = pot.maxBet - currentBet;
          pot.playerBets[playerId] = pot.maxBet;
          pot.total += diff;
          bet -= diff;
        } else if (currentBet < pot.maxBet && bet + currentBet < pot.maxBet) {
          pot.playerBets[playerId] += bet;
          pot.total += bet;
          bet = 0;
        }
      }

    }
    // i++;
  }
}


export async function endHand(
  players: Player[],
  game: Game,
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): Promise<void> {
  await Promise.all(
    players
      .filter((player) => player.stack === 0 || player.folded)
      .map(async (player) => {
        if (player.stack === 0) {
          player.active = false;
          setTimeout(() => {
            log(
              game.id,
              `${player.id} loses and leaves the table (out of chips)`,
              io
            );
          }, 4000);
        } else if (player.folded) {
          player.folded = false;
        }
        await updatePlayer(player.id, {
          active: player.active,
          folded: player.folded,
          updatedAt: new Date()
        });
      })
  );
}


export function canChangeTurn(game: Game): boolean {
  return game.startedAt !== null && !game.endedAt !== null;
}


export async function paySmallBlind(
  dealerPlayer: Player,
  players: Player[],
  game: Game,
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): Promise<void> {
  const isHeadsUp = players.length === 2;
  // pay small blind
  // TODO: consider using changeTurn() instead of getNextPlayer() directly
  const smallBlind = isHeadsUp
    ? dealerPlayer
    : await getNextPlayer(players, dealerPlayer.id);

  smallBlind.smallBlind = true;
  game.currentPlayerId = smallBlind.id;
  const amount = Math.min(getSmallBlindBet(game), smallBlind.stack);
  await bet(game.id, smallBlind, amount, game, io);
  await recordAction({
    gameId: game.id,
    socketId: smallBlind.socketId,
    playerId: smallBlind.id,
    action: Action.CALL,
    bet: game.bet,
  });
  log(game.id, `${smallBlind.id} BETS ${amount} (small blind)`, io);
  updatePotsAfterBet(game, smallBlind.id, amount);
}

export async function payBigBlind(
  players: Player[],
  game: Game,
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): Promise<void> {
  const bigBlind = await getNextPlayer(players, game.currentPlayerId);

  bigBlind.bigBlind = true;
  game.currentPlayerId = bigBlind.id;
  await updateGame(game.id, {
    currentPlayerId: game.currentPlayerId,
  });
  const amount = Math.min(getBigBlindBet(game), bigBlind.stack);
  await bet(game.id, bigBlind, amount, game, io);
  await recordAction({
    gameId: game.id,
    socketId: bigBlind.socketId,
    playerId: bigBlind.id,
    action: Action.CALL,
    bet: game.bet,
  });
  log(game.id, `${bigBlind.id} BETS ${amount} (big blind)`, io);
  updatePotsAfterBet(game, bigBlind.id, amount);
}


export async function bet(
  gameId: string,
  player: Player,
  amount: number,
  game: Game,
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): Promise<void> {
  const room = getRoomName(gameId);
  player.stack -= amount;
  player.bet += amount;
  player.lastBet = player.bet;
  await updatePlayer(player.id, {
    stack: player.stack,
    bet: player.bet,
    lastBet: player.lastBet,
    updatedAt: new Date(),
    lastStreet: game.street as unknown as PlayerStreet
  });
  if (player.bet > game.bet) {
    game.bet = player.bet;
    await updateGame(game.id, {
      bet: game.bet,
    });
  }
  // console.log("game when in bet  : ", game);
  io.to(room).emit("betUpdated", game.bet);
}


export async function startNextStreet(game: Game, players: Player[], io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>): Promise<void> {
  // end previous street
  // - record all player bets
  // - distribute bets to pots
  // - set player bets to 0
  // updatePots(game, players);

  // start new street
  game.street = getNextStreet(game.street);
  const communityCards = getCommunityCards(game);
  game.bet = 0;
  await updateGame(game.id, {
    street: game.street,
    bet: game.bet,
    // @ts-ignore-next-line
    pots: JSON.stringify(game.pots),
  });
  for (const player of players) {
    player.lastAction = null;
    player.bet = 0;
    await updatePlayer(player.id, {
      bet: player.bet,
      lastAction: player.lastAction,
      updatedAt: new Date(),
    });
  }
  const room = getRoomName(game.id);
  log(game.id, `Moving to ${game.street}`, io);
  io.to(room).emit("communityCardsUpdated", communityCards);
  notifyBestHand(players, communityCards, io);
  io.to(room).emit("betUpdated", game.bet);
  notifyPotsUpdated(game, io);
}



export function updatePotsAfterAllIn(game: Game, playerId: string, bet: number): void {
  updatePotsAfterBet(game, playerId, bet, true);
  // game.pots[game.pots.length - 1].locked = true;

  // if in the last pot players have more than this player, we need to move the
  // surplus to a new pot
  // let lastPot = game.pots.at(-1)!;
  // const newMaxBet = lastPot.playerBets[playerId] ?? 0;
  // if (newMaxBet < lastPot.maxBet) {
  //   lastPot.maxBet = newMaxBet;
  //   const newPot = createPot();
  //   game.pots.push(newPot);

  // for (const pid of Object.keys(lastPot.playerBets)) {
  //   const playerBet = lastPot.playerBets[pid];
  //   const diff = playerBet - newMaxBet;
  //   if (diff > 0) {
  //     lastPot.playerBets[pid] -= diff;
  //     lastPot.total -= diff;
  //     newPot.playerBets[pid] = diff;
  //     newPot.total += diff;
  //     newPot.maxBet = Math.max(newPot.maxBet, diff);
  //   }
  // }
  // }
}


export async function call(gameId: string, socketId: string, io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>): Promise<void> {
  const game = await getGame(gameId);
  if (!game) return;
  // console.log("game >>>>> ", game)
  const player = await getPlayerBySocketId(gameId, socketId);
  await recordAction({
    gameId: game.id,
    socketId,
    playerId: player?.id,
    action: Action.CALL,
    bet: game.bet,
  });
  if (!player) return;

  // console.log('player >>>>> ', player)
  let players = await getActiveUnfoldedPlayers(gameId);

  // let lastHistory = await knex.select('id', 'playerId').from('actionHistory').where({ 'gameId': gameId }).orderBy('id', 'desc').limit(2);
  // console.log("game id >> ", gameId)

  if (!canCall(player, game, players)) {
    return;
  }

  // console.log('cancall >>>>> ', !canCall(player, game, players));

  let callAmount = getCallAmount(player, game);
  await bet(gameId, player, callAmount, game, io);
  player.lastAction = Action.CALL;
  await updatePlayer(player.id, {
    lastAction: player.lastAction,
    updatedAt: new Date(),
    lastStreet: game.street as unknown as PlayerStreet
  });
  log(gameId, `${player.id} CALLs ${callAmount}`, io);
  updatePotsAfterBet(game, player.id, callAmount);
  await updateGame(game.id, {
    // @ts-ignore-next-line
    pots: JSON.stringify(game.pots),
  });
  notifyPotsUpdated(game, io);
  await notifySeatsUpdated(players, game, io);
  console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")
  console.log("seats updated ")
  console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")
  await changeTurn(gameId, io);
}

export async function raise(
  gameId: string,
  socketId: string,
  amount: number,
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): Promise<void> {
  const game = await getGame(gameId);
  if (!game) return;
  const player = await getPlayerBySocketId(gameId, socketId);
  await recordAction({
    gameId: game.id,
    socketId,
    playerId: player?.id,
    action: Action.RAISE,
    amount,
    bet: game.bet,
  });
  if (!player) return;
  // let lastHistory = await knex.select('id', 'playerId').from('actionHistory').where({ 'gameId': gameId }).orderBy('id', 'desc').limit(2);

  let players = await getActiveUnfoldedPlayers(gameId);
  if (!(await canRaise(player, game, players, amount))) {
    return;
  }
  const logMessage =
    game.bet === 0
      ? `${player.id} BETS ${amount}`
      : `${player.id} RAISES by ${amount}`;
  player.lastAction = Action.RAISE;
  await bet(gameId, player, amount, game, io);
  await updatePlayer(player.id, {
    lastAction: player.lastAction,
    updatedAt: new Date(),
    lastStreet: game.street as unknown as PlayerStreet
  });
  const room = getRoomName(gameId);
  io.to(room).emit("betUpdated", game.bet);
  log(gameId, logMessage, io);
  updatePotsAfterBet(game, player.id, amount);
  await updateGame(game.id, {
    // @ts-ignore-next-line
    pots: JSON.stringify(game.pots),
  });
  notifyPotsUpdated(game, io);
  await notifySeatsUpdated(players, game, io);
  await changeTurn(gameId, io);
}

export async function check(
  gameId: string,
  socketId: string,
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): Promise<void> {
  const game = await getGame(gameId);
  if (!game) return;
  const player = await getPlayerBySocketId(gameId, socketId);
  await recordAction({
    gameId: game.id,
    socketId,
    playerId: player?.id,
    action: Action.CHECK,
    bet: game.bet,
  });
  if (!player) return;
  if (!canCheck(player, game)) {
    console.log(`can't check ${player.id}`);
    return;
  }
  player.lastAction = Action.CHECK;
  await updatePlayer(player.id, {
    lastAction: player.lastAction,
    updatedAt: new Date(),
    lastStreet: game.street as unknown as PlayerStreet
  });
  log(gameId, `${player.id} CHECKS`, io);
  const players = await getActiveUnfoldedPlayers(gameId);
  await notifySeatsUpdated(players, game, io);
  console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")
  console.log("seats updated ",)
  console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")
  await changeTurn(gameId, io);
}

export async function leave(
  gameId: string,
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  socketId?: string,
  leavePlayer?: Player
): Promise<void> {
  console.log("player leaving out...")
  const game = await getGame(gameId);
  if (!game) return;
  let player;
  if (socketId) {
    player = await getPlayerBySocketId(gameId, socketId);

  } else if (leavePlayer) {
    player = leavePlayer;
  }
  if (!player) return;

  // console.log(`player info from socket : ${player}`);
  // console.log(`id : ${player?.id}`)
  // console.log(`address : ${player?.address}`)
  // console.log(`leaving for playerID ${player.id} ...`)


  // await updatePotsAfterFold(game);
  // await updateGame(game.id, {
  //   // @ts-ignore-next-line
  //   pots: JSON.stringify(game.pots),
  // });
  // notifyPotsUpdated(game);

  // if (leavePlayer) {
  //   await changeTurn(gameId, true);
  // } else {
  // }

  // gamestarted check
  // console.log(game.startedAt)
  if (!game.startedAt) {
    console.log(`game not started.`)

    // ====================  
    await recordAction({
      gameId: game.id,
      socketId: player.socketId,
      playerId: player?.id,
      action: Action.LEAVE,
      bet: game.bet,
    });
    player.lastAction = Action.LEAVE;
    player.active = false;
    player.bet = 0;
    await updatePlayer(player.id, {
      bet: player.bet,
      lastAction: player.lastAction,
      active: player.active,
      seatId: 0,
      lastStreet: game.street as unknown as PlayerStreet
    });
    console.log(`updated playerId ${player.id} to deactive.`)
    log(gameId, `${player.id} LEAVE`, io);
    // ====================

    // await knex.raw(`delete from players where "gameId"='${gameId}' and id='${player.id}'`)
    const players = await getActiveUnfoldedPlayers(gameId);

    console.log(`active players : ${players.length}`)

    await notifySeatsUpdated(players, game, io);
    if (game.mode == GameMode.TABLE) {
      // return entry fee back to user
      let payToken = await getTokenById(game.payToken);

      if (payToken?.address == SOL_ADDRESS) {
        userLeaveTableOnChain(game.initialStack, game.buyIn, game.minBet, game.numSeats, new PublicKey(player.address))
      } else if (payToken?.address) {
        userLeaveTableWithTokenOnChain(game.initialStack, game.buyIn, game.minBet, game.numSeats, new PublicKey(player.address), new PublicKey(payToken?.address))
      }


      let currentGamePlayers = await knex<Player>("players").select().where({
        gameId: game.id
      });
      let currentGameActivePlayers = await getActiveUnfoldedPlayers(game.id);

      setTimeout(async () => {
        let nextGame = await getGame(game.id);
        let nextGamePlayers = await knex<Player>("players").select().where({
          gameId: game.id
        });
        let nextGameActivePlayers = await getActiveUnfoldedPlayers(game.id);

        if (currentGamePlayers.length == nextGamePlayers.length &&
          currentGameActivePlayers.length == nextGameActivePlayers.length && nextGame && !nextGame.startedAt && nextGameActivePlayers.length > 1) {
          await startGame(game, io);
          let existingGames = await getExistingGames();
          io.emit("activeGameUpdated", existingGames)
        }
      }, AUTO_START_TIME);

      let existingGames = await getExistingGames();
      io.emit("activeGameUpdated", existingGames)
    } else {
      let tournament = await getTournamentById(game.tableId);
      if (!tournament) {
        return;
      }
      let payToken = await getTokenById(game.payToken);
      if (payToken?.address == SOL_ADDRESS) {
        await userLeaveTournament(tournament.initialStack, tournament.buyIn, tournament.minBet, tournament.totalSeats, new PublicKey(player.address));
      } else if (payToken?.address) {
        await userLeaveTournamentWithToken(tournament.initialStack, tournament.buyIn, tournament.minBet, tournament.totalSeats, new PublicKey(player.address), new PublicKey(payToken?.address));
      }
    }

  } else if (!game.ended) {
    console.log(`game is performing..`)
    // ====================  
    await recordAction({
      gameId: game.id,
      socketId: player.socketId,
      playerId: player?.id,
      action: Action.LEAVE,
      bet: game.bet,
    });
    player.lastAction = Action.LEAVE;
    player.active = false;
    player.bet = 0;
    await updatePlayer(player.id, {
      bet: player.bet,
      lastAction: player.lastAction,
      active: player.active,
      lastStreet: game.street as unknown as PlayerStreet
    });
    console.log(`updated playerId ${player.id} to deactive.`)
    log(gameId, `${player.id} LEAVE`, io);
    // ====================


    if (game.currentPlayerId == player.id) {

      await changeTurn(gameId, io);
    } else {
      const players = await getActiveUnfoldedPlayers(gameId);
      await notifySeatsUpdated(players, game, io);

      if (players.length == 1) {
        await showdown(game, players, io);
      }
    }
  }
}

export async function fold(gameId: string, io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>, socketId?: string, foldPlayer?: Player): Promise<void> {
  // console.log("fold started----------------------------------------")
  const game = await getGame(gameId);
  if (!game) return;
  let player;
  if (socketId) {
    player = await getPlayerBySocketId(gameId, socketId);
    await recordAction({
      gameId: game.id,
      socketId,
      playerId: player?.id,
      action: Action.FOLD,
      bet: game.bet,
    });
  } else if (foldPlayer) {
    player = foldPlayer;
    await recordAction({
      gameId: game.id,
      socketId: foldPlayer.socketId,
      playerId: player?.id,
      action: Action.FOLD,
      bet: game.bet,
    });
  }
  if (!player) return;
  if (!canFold(player, game)) {
    return;
  }
  player.lastAction = Action.FOLD;
  player.folded = true;
  player.bet = 0;
  await updatePlayer(player.id, {
    bet: player.bet,
    lastAction: player.lastAction,
    folded: player.folded,
    updatedAt: new Date(),
    lastStreet: game.street as unknown as PlayerStreet
  });
  log(gameId, `${player.id} FOLDS---------------------------`, io);

  // await updatePotsAfterFold(game);
  // await updateGame(game.id, {
  //   // @ts-ignore-next-line
  //   pots: JSON.stringify(game.pots),
  // });
  // notifyPotsUpdated(game);
  const players = await getActiveUnfoldedPlayers(gameId);
  await notifySeatsUpdated(players, game, io);
  await changeTurn(gameId, io);
}

export async function allIn(
  gameId: string,
  socketId: string,
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): Promise<void> {
  const game = await getGame(gameId);
  if (!game) return;
  const player = await getPlayerBySocketId(gameId, socketId);
  await recordAction({
    gameId: game.id,
    socketId,
    playerId: player?.id,
    action: Action.ALL_IN,
    bet: game.bet,
  });
  if (!player) return;
  let players = await getActiveUnfoldedPlayers(gameId);
  // let lastHistory = await knex.select('id', 'playerId').from('actionHistory').where({ 'gameId': gameId }).orderBy('id', 'desc').limit(2);

  if (!canAllIn(player, game, players)) {
    return;
  }
  const maxRaise = await getMaxBet(player, game);
  player.lastAction = Action.ALL_IN;
  await bet(gameId, player, maxRaise, game, io);
  await updatePlayer(player.id, {
    lastAction: player.lastAction,
    updatedAt: new Date(),
    lastStreet: game.street as unknown as PlayerStreet
  });
  const room = getRoomName(gameId);
  io.to(room).emit("betUpdated", game.bet);
  log(gameId, `${player.id} goes ALL-IN`, io);
  updatePotsAfterAllIn(game, player.id, maxRaise);
  await updateGame(game.id, {
    // @ts-ignore-next-line
    pots: JSON.stringify(game.pots),
  });
  notifyPotsUpdated(game, io);
  await notifySeatsUpdated(players, game, io);
  await changeTurn(gameId, io);
}

export const startGame = async (
  game: Game,
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  gameMode: GameMode = GameMode.TABLE
) => {

  game.startedAt = new Date();
  game.updatedAt = new Date();
  await updateGame(game.id, {
    startedAt: game.startedAt,
    updatedAt: game.updatedAt,
  });
  const room = getRoomName(game.id);
  io.to(room).emit("gameStarted");
  log(game.id, "Game started", io);

  await startHand(game, io);

  // add a new game 
  if (gameMode == GameMode.TABLE) {
    const table = await getTable(game.tableId);
    await insertGame({
      tableId: game.tableId,
      numSeats: table?.numSeats,
      minBet: table?.minBet,
      initialStack: table?.initialStack,
      buyIn: table?.buyIn,
      blindIncreaseMode: table?.blindIncreaseMode,
      blindIncreaseTime: table?.blindIncreaseTime,
      blindIncreaseRound: table?.blindIncreaseRound,
      blindIncreaseMulti: table?.blindIncreaseMulti,
      payToken: table?.payToken
    });
  }
}

export async function getExistingGames(): Promise<ActiveGame[]> {
  let result = await knex.raw(`
  select 
  t2.*, 
  tables.name, 
  tables."numSeats",
  tables."minBet",
  tables."initialStack",
  tables."buyIn",
  tokens.name as "payTokenName",
  tokens.address as "payTokenAddress",
  tokens.decimal as "payTokenDecimal"
  from 
    (
      select 
        games."tableId", 
        games.id as "gameId", 
		games."payToken",
        coalesce(t.count, 0) as count
      from 
        (
          select 
            "gameId", 
            count(*)
          from 
            players 
          where active = true
          group by 
            "gameId"
        ) t 
        right join 
          games 
        on 
          t."gameId" =games.id
        where games."startedAt" IS NULL
    ) t2 
    left join 
      tables 
    on 
      tables.id=t2."tableId"
	left join
	 tokens
	on t2."payToken" = tokens.id
    where 
      tables.status=true
    order by "buyIn" desc`);

  return result.rows;
}

export const getValidAfkGames = async (wallet: string): Promise<ActiveGame[]> => {
  try {
    let players = await knex<Player>("players").select().where({ address: wallet, lastAction: Action.AFK })
    if (!players) {
      return []
    }
    let games: ActiveGame[] = [];
    await Promise.all(
      players.map(async (player) => {
        // let [game] = await knex<Game>("games").select().where({ id: player.gameId, ended: false });
        // if (game) games.push(game);
        let result = await knex.raw(
          `
          select 
            games.*,
            coalesce(t.count, 0) as count,
			tokens.name as "payTokenName",
			tokens.address as "payTokenAddress",
			tokens.decimal as "payTokenDecimal"
          from 
            (
              select 
                "gameId", 
                count(*)
              from 
                players 
              where active = true
              group by 
                "gameId"
            ) t 
          right join 
            games 
          on 
            t."gameId" =games.id
		left join tokens on tokens.id = games."payToken"
          where games."startedAt" IS NOT NULL and (games."endedAt" is null or games.ended = false) and games.id = '${player.gameId}'
          `
        )

        if (result && result.rows && result.rows[0]) {
          console.log("  afk games >> ", result.rows[0])
          if (result.rows[0].mode == GameMode.TOURNAMENT) {
            let tournament = await getTournamentById(result.rows[0].tableId);
            console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")
            console.log(tournament)
            console.log("===================================")
            if (tournament) {
              let name = tournament.name;
              games.push({ ...result.rows[0], name })
            }
          } else {
            let tableName = await getTableNameFromId(result.rows[0].tableId);
            games.push({ ...result.rows[0], name: tableName });
          }
        }
      })
    );
    return games;

  } catch (e) {
    console.log("err on getValidAfkGames >> ", e);
    return []
  }
}

export const canRejoinGameFromAfk = async (wallet: string, gameId: string): Promise<boolean> => {
  try {
    let [player] = await knex<Player>("players").select().where({ address: wallet, gameId: gameId, lastAction: Action.AFK });

    if (!player) return false;
    let [game] = await knex<Game>("games").select().where({ id: gameId, ended: false });
    if (!game) return false;
    else return true;
  } catch (e) {
    console.log("err on rejoinGameFromAfk >> ", e);
    return false;
  }
}

export const rejoinGameFromAfk = async (wallet: string, gameId: string, socketId: string): Promise<string | null> => {
  try {
    let [player] = await knex<Player>("players").select().where({ address: wallet, gameId: gameId, lastAction: Action.AFK });
    if (!player) return null;
    let [game] = await knex<Game>("games").select().where({ id: gameId, ended: false });
    if (!game) return null;

    player.lastAction = null;
    player.folded = false;
    player.active = true;
    await updatePlayer(player.id,
      {
        lastAction: player.lastAction,
        folded: player.folded,
        active: player.active,
        socketId: socketId
      }
    );
    return player.id;
  } catch (e) {
    console.log("err on rejoinGameFromAfk", e);
    return null;
  }
}

// export const getWinnersOnTournaments = async (
//   players: Player[],
//   game: Game
// ): Promise<Player[]> => {
//   let result: Player[] = []
//   let communityCardsLength = game.street == Street.PREFLOP ? 0 : game.street == Street.FLOP ? 3 : game.street == Street.TURN ? 4 : game.street == Street.RIVER ? 5 : 0;
//   let communityCards = game.communityCards.slice(0, communityCardsLength);
//   const playerCards = players.map((p) =>
//     Hand.solve(getSolverCards([...p.cards, ...communityCards]))
//   );
//   let winnersSet = new Set(Hand.winners(playerCards));
//   for (let i = 0; i < players.length; i++) {
//     const cards = playerCards[i];

//     if (winnersSet.has(cards)) {
//       result.push(players[i])
//     }
//   }
//   let remainedPlayers = players.filter((player, _index) => player.address !== result[0].address);
//   if (remainedPlayers.length == 1) {
//     result.push(remainedPlayers[0])
//     return result;
//   }
//   let remainedPlayerResult = await getWinnersOnTournaments(remainedPlayers, game);
//   return [...result, ...remainedPlayerResult];
// }

export const getWinnersOnTournaments = async (players: Player[], game: Game): Promise<Player[]> => {
  let remainingPlayers = players;
  let communityCardsLength = game.street == Street.PREFLOP ? 0 : game.street == Street.FLOP ? 3 : game.street == Street.TURN ? 4 : game.street == Street.RIVER ? 5 : 0;
  let communityCards = game.communityCards.slice(0, communityCardsLength);
  let winningPlayers: Player[] = [];

  do {
    let remainingPlayersTmp: Player[] = [];
    if (remainingPlayers.length == 1) {
      winningPlayers.push(remainingPlayers[0]);
      break;
    }
    const playerCards = remainingPlayers.map((p) =>
      Hand.solve(getSolverCards([...p.cards, ...communityCards]))
    );
    let winnersSet = new Set(Hand.winners(playerCards));
    for (let i = 0; i < remainingPlayers.length; ++i) {
      const cards = playerCards[i];
      if (winnersSet.has(cards)) {
        winningPlayers.push(remainingPlayers[i]);

      } else {
        remainingPlayersTmp.push(remainingPlayers[i])
      }
    }
    remainingPlayers = remainingPlayersTmp;

  } while (remainingPlayers.length > 0)
  return winningPlayers;
}