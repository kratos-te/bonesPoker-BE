import { Game, GameMode } from "../types/Game";
import { Player } from "../types/Player";
import { Tournament, TournamentStatus } from "../types/Tournament";

import { getKnex } from "../knex";
import { getActiveTournamentGames, getGame, getRoomName, startGame, updateGame } from "./games";
import {
  getActivePlayers,
  getActivePlayersFromGameId, getActiveUnfoldedPlayers, getPlayersFromGameId, sitOnGameTable, updatePlayer
} from './players';

import { Server } from "socket.io";

import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../utils/Socketio";

import { getTokenById } from "./tokens";
import { PlayerStreet } from "../types/Street";

const knex = getKnex();

export const insertTournament = async (args: Partial<Tournament>): Promise<Tournament | null> => {
  try {
    const [tournament] = await knex<Tournament>("tournamentTables").insert(
      {
        ...args,
      },
      "*"
    );
    return tournament;
  } catch (e) {
    console.log("err on insertTournament", e)
    return null;
  }
}

export const getActiveTournaments = async (): Promise<Tournament[]> => {
  try {
    // let result = await knex<Tournament>("tournamentTables").select("tournamentTables.*").select({ payToken: 'tokens.id', payTokenName: 'tokens.name', payTokenAddress: 'tokens.address', payTokenDecimal: 'tokens.decimal' }).where({ status: TournamentStatus.ACTIVE }).where("startAt", ">=", new Date()).leftJoin("tokens", "tokens.id", "tournamentTables.payToken");
    // console.log(result)
    let result = await knex.raw(`
    select "tournamentTables".*, tokens.id as "payToken", tokens.address as "payTokenAddress", tokens.name as "payTokenName", tokens.decimal as "payTokenDecimal",
    coalesce(t2.count, 0) as count
    from "tournamentTables" left join tokens on "tournamentTables"."payToken" =tokens.id 
    left join (
    select sum(t.count) as count, games."tableId" from (
    select 
      "gameId", 
      count(*)
    from 
      players 
    where active = true and mode='${GameMode.TOURNAMENT}'
    group by 
      "gameId") t left join games on games.id =t."gameId"
      group by "tableId"
    ) t2 on t2."tableId" = "tournamentTables".id
    where "tournamentTables"."startAt" >=Now() and "tournamentTables".status='${TournamentStatus.ACTIVE}' 
      `)
    // console.log("tournaments >> ", result.rows)
    return result.rows;
  } catch (e) {
    console.log("err on getActiveTournaments >> ", e);
    return [];
  }
}

export const isActiveTournament = async (tournamentId: string): Promise<boolean> => {
  try {
    let result = await knex<Tournament>("tournamentTables").select().where({ id: tournamentId });
    if (
      result.length == 1 &&
      result[0].status &&
      result[0].startAt &&
      new Date(result[0].startAt).getTime() > new Date().getTime() &&
      result[0].enterAt &&
      new Date(result[0].enterAt).getTime() < new Date().getTime()
    ) {
      return true;
    } else {
      return false;
    }
  } catch (e) {
    console.log("err on isActiveTournament >> ", e);
    return false;
  }
}

export const canSitTournament = async (tournamentId: string, playerWallet: string): Promise<boolean> => {

  try {
    let result = await knex.raw(`
    select t.id, players.id as playerId, players.address  from (select * from games where "tableId" ='${tournamentId}' and mode='${GameMode.TOURNAMENT}' ) as t left join players on t.id = players."gameId" where players.address='${playerWallet}' and players.active = true
    `);
    if (result.rows.length > 0) {
      return false;
    } else {
      return true;
    }
  } catch (e) {
    console.log("err on canSitTournament >> ", e)
    return false;
  }

}

export const isFullTournament = async (tournamentId: string): Promise<boolean> => {
  try {
    let [tournament] = await knex<Tournament>("tournamentTables").select().where({ id: tournamentId });
    let players = await knex.raw(`
    select 
        t.id, 
        players.id as playerId, 
        players.address  
    from 
        (
            select 
                * 
            from 
                games 
            where 
                "tableId" ='${tournamentId}' and 
                mode='${GameMode.TOURNAMENT}'
        ) as t 
    left join 
        players 
    on 
        t.id = players."gameId" 
    where 
        players.active = true
  `);

    if (players.rows.length < tournament.totalSeats) {
      return false;
    } else {
      return true;
    }
  } catch (e) {
    console.log("err on isFullTournament >> ", e)
    return false;
  }
}

export const sitTournament = async (tournamentId: string, player: string, socketId: string): Promise<[string, string] | [null, null]> => {
  try {
    let games = await knex<Game>("games").select().where({ tableId: tournamentId, mode: GameMode.TOURNAMENT, startedAt: null });


    for (let i = 0; i < games.length; i++) {
      let game = games[i];
      let gamePlayers = await getActivePlayersFromGameId(game.id);
      if (gamePlayers.length < game.numSeats) {
        let playerId = await sitOnGameTable(game.id, player, socketId);
        console.log("playerId >> ", playerId)
        if (playerId) {
          return [game.id, playerId];

        }
      }
    }
    return [null, null];
  } catch (e) {
    console.log("err on sitTournament >> ", e);
    return [null, null];
  }
}


export const getTournamentPlayers = async (tournamentId: string): Promise<Player[]> => {
  try {
    let games = await getActiveTournamentGames(tournamentId);
    if (games && games.length > 0) {
      let players: Player[] = [];
      for (let i = 0; i < games.length; i++) {
        let _players = await getPlayersFromGameId(games[i].id);
        players = [...players, ..._players];
      }
      return players;
    } else {
      return [];
    }
  } catch (e) {
    console.log("err on getTournamentPlayers >> ", e);
    return [];
  }
}

export const getPlayersFromEndedTournament = async (tournamentId: string): Promise<Player[]> => {
  try {
    let games = await getActiveTournamentGames(tournamentId, true);
    if (games && games.length > 0) {
      let players: Player[] = [];
      for (let i = 0; i < games.length; i++) {
        let _players = await getPlayersFromGameId(games[i].id);
        players = [...players, ..._players];
      }
      return players;
    } else {
      return [];
    }
  } catch (e) {
    console.log("err on getTournamentPlayers >> ", e);
    return [];
  }
}

export const getTournamentById = async (tournamentId: string): Promise<Tournament | null> => {
  try {
    let [tournament] = await knex<Tournament>("tournamentTables").select().where({ id: tournamentId });
    return tournament;
  } catch (e) {
    console.log("err on getTournamentById >> ", e)
    return null;
  }
}

export const getTournamentsByQuery = async (tournament: Partial<Tournament>): Promise<Tournament[]> => {
  try {
    let tournaments = await knex<Tournament>("tournamentTables").select().where(tournament).where("startAt", ">=", new Date());
    return tournaments
  } catch (e) {
    console.log("err on getTournamentsByQuery >> ", e);
    return [];
  }
}

export const startTournament = async (
  tournamentId: string,
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): Promise<void> => {
  try {

    let tournament = await getTournamentById(tournamentId);
    if (!tournament) return;
    let payToken = await getTokenById(tournament.payToken);
    if (!payToken) {
      return;
    }
    // removeTournamentOnChain(tournament.initialStack, tournament.buyIn, tournament.minBet, tournament.totalSeats, new PublicKey(payToken.address));
    let existingTournaments = await getActiveTournaments();
    io.emit("activeTournamentUpdated", existingTournaments);

    await updateTournament(tournamentId, {
      status: TournamentStatus.RUNNING
    })

    let tournamentGames = await getActiveTournamentGames(tournamentId);


    await Promise.all(tournamentGames.map(async game => {
      return await startGame(game, io, GameMode.TOURNAMENT);
    }))
  } catch (e) {
    console.log("err on startTournament >> ", e)
  }
}



export const updateTournament = async (tournamentId: string, tournament: Partial<Tournament>): Promise<void> => {
  await knex<Tournament>("tournamentTables").update(tournament).where({
    id: tournamentId
  });
}

/*
  returns a game Id that can be merged with
*/
export const canBeMerged = async (fromGame: Game): Promise<string | null> => {
  try {
    let remainedPlayers = fromGame.numSeats - (await getActiveUnfoldedPlayers(fromGame.id)).length;
    const tournamentGames = await getActiveTournamentGames(fromGame.tableId, true);
    for (let tournamentGame of tournamentGames) {
      let gameActivePlayers = await getActivePlayers(tournamentGame.id);
      if (tournamentGame.id != fromGame.id && gameActivePlayers.length > 1 && !tournamentGame.ended && gameActivePlayers.length <= remainedPlayers) {
        return tournamentGame.id;
      }
    }
    return null;
  } catch (e) {
    console.log("err on canBeMerged >> ", e);
    return null;
  }
}

export const canMergeOtherTable = async (toGame: Game): Promise<string | null> => {
  try {
    if (toGame.mode == GameMode.TOURNAMENT) {
      let toGameActivePlayers = await getActivePlayers(toGame.id)
      let tournamentGames = await getActiveTournamentGames(toGame.tableId, true);
      for (let tournamentGame of tournamentGames) {
        let activePlayers = await getActivePlayers(tournamentGame.id);
        if (tournamentGame.id != toGame.id && activePlayers.length == 1 && toGame.numSeats - toGameActivePlayers.length >= 1) {
          return tournamentGame.id;
        }
      }
      return null;
    } else {
      return null;
    }
  } catch (e) {
    console.log("err on canMergeOtherTable >> ", e);
    return null;
  }
}

export const mergeFromGame = async (game: Game, fromGameId: string, io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>): Promise<boolean> => {
  try {
    let fromGame = await getGame(fromGameId);
    let toGamePlayers = await getActivePlayers(game.id);

    if (fromGame && fromGame.mode == GameMode.TOURNAMENT && game.mode == GameMode.TOURNAMENT) {
      let fromGamePlayers = await getActivePlayersFromGameId(fromGameId);
      if (fromGamePlayers.length == 1) {
        let fromGamePlayer = fromGamePlayers[0];

        let seatIds = [];
        let seatId = 0;
        for (let toGamePlayer of toGamePlayers) {
          seatIds.push(toGamePlayer.seatId);
        }

        for (let i = 1; i <= game.numSeats; i++) {
          if (!seatIds.includes(i)) {
            seatId = i;
            break;
          }
        }

        if (seatId == 0) {
          return false;
        }

        let fromGamePlayerSocket = io.sockets.sockets.get(fromGamePlayer.socketId);
        let room = getRoomName(fromGamePlayer.gameId);

        let lastUpdatedTime = new Date('2000-01-01T00:00:00.000Z').getTime();

        for (let activePlayer of toGamePlayers) {
          if (lastUpdatedTime < new Date(activePlayer.updatedAt).getTime()) {
            lastUpdatedTime = new Date(activePlayer.updatedAt).getTime();
          }
        }
        let countdownStartValue = Math.floor((new Date().getTime() - lastUpdatedTime) / 1000)

        if (fromGamePlayerSocket) {
          io.to(fromGamePlayerSocket?.id).emit("resitTournamentTable", game.id, countdownStartValue);
          console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>> 1")
        }
        fromGamePlayerSocket?.leave(room);

        room = getRoomName(game.id);
        fromGamePlayerSocket?.join(room);

        fromGamePlayer.gameId = game.id;
        fromGamePlayer.seatId = seatId;
        fromGamePlayer.bet = 0;
        fromGamePlayer.folded = false;
        fromGamePlayer.lastStreet = game.street as unknown as PlayerStreet;

        await updatePlayer(fromGamePlayer.id, {
          gameId: fromGamePlayer.gameId,
          seatId: fromGamePlayer.seatId,
          bet: fromGamePlayer.bet,
          folded: fromGamePlayer.folded,
          updatedAt: new Date(),
          lastStreet: fromGamePlayer.lastStreet
        });

        fromGame.ended = true;
        fromGame.endedAt = new Date();

        await updateGame(fromGameId, {
          ended: fromGame.ended,
          endedAt: fromGame.endedAt
        });


        return true;
      } else {
        return false
      }
    } else {
      return false;
    }
  } catch (e) {
    console.log("err on mergeFromGame >> ", e);
    return false;
  }

}

export const merge2Game = async (fromGame: Game, toGameId: string, io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>): Promise<boolean> => {
  try {
    let toGame = await getGame(toGameId);
    let fromGameActivePlayers = await getActivePlayers(fromGame.id);
    let toGameActivePlayers = await getActivePlayers(toGameId);

    if (fromGame.mode == GameMode.TOURNAMENT && toGame && !toGame.ended && toGame.mode == GameMode.TOURNAMENT && toGame.numSeats - toGameActivePlayers.length >= fromGameActivePlayers.length && toGameActivePlayers.length >= 1 && fromGameActivePlayers.length >= 1) {
      let invalidSeatIds = [];
      for (let player of toGameActivePlayers) {
        invalidSeatIds.push(player.seatId)
      }
      let emptySeatIds = [];
      for (let i = 1; i <= toGame.numSeats; i++) {
        if (invalidSeatIds.includes(i)) {
          emptySeatIds.push(i)
        }
      }

      // if (fromGameActivePlayers.length > 0) {
      //   let room = getRoomName(fromGameActivePlayers[0].gameId);


      // }
      for (let i = 0; i < fromGameActivePlayers.length; i++) {
        let fromGamePlayer = fromGameActivePlayers[i];

        let fromGamePlayerSocket = io.sockets.sockets.get(fromGamePlayer.socketId);
        // fromGamePlayerSocket?.client


        let room = getRoomName(fromGamePlayer.gameId)


        let lastUpdatedTime = new Date('2000-01-01T00:00:00.000Z').getTime();

        for (let activePlayer of toGameActivePlayers) {
          if (lastUpdatedTime < new Date(activePlayer.updatedAt).getTime()) {
            lastUpdatedTime = new Date(activePlayer.updatedAt).getTime();
          }
        }
        let countdownStartValue = Math.floor((new Date().getTime() - lastUpdatedTime) / 1000)

        if (fromGamePlayerSocket) {
          io.to(fromGamePlayerSocket?.id).emit("resitTournamentTable", toGameId, countdownStartValue);
          console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>> 2")
        }

        fromGamePlayerSocket?.leave(room);

        room = getRoomName(toGameId);
        fromGamePlayerSocket?.join(room);

        fromGamePlayer.gameId = toGameId;
        fromGamePlayer.seatId = emptySeatIds[i];
        fromGamePlayer.bet = 0;
        fromGamePlayer.cards = [];
        fromGamePlayer.dealer = false;
        fromGamePlayer.smallBlind = false;
        fromGamePlayer.bigBlind = false;
        fromGamePlayer.lastAction = null;
        fromGamePlayer.folded = true;
        fromGamePlayer.lastStreet = toGame.street as unknown as PlayerStreet;

        await updatePlayer(fromGamePlayer.id, {
          seatId: fromGamePlayer.seatId,
          bet: fromGamePlayer.bet,
          cards: fromGamePlayer.cards,
          dealer: fromGamePlayer.dealer,
          smallBlind: fromGamePlayer.smallBlind,
          bigBlind: fromGamePlayer.bigBlind,
          lastAction: fromGamePlayer.lastAction,
          folded: fromGamePlayer.folded,
          updatedAt: new Date(),
          lastStreet: fromGamePlayer.lastStreet
        });
      }

      fromGame.ended = true;
      fromGame.endedAt = new Date();
      await updateGame(fromGame.id, {
        ended: fromGame.ended,
        endedAt: fromGame.endedAt
      });

      return true;

    } else {
      return false;
    }
  } catch (e) {
    console.log("err on merged2Game >> ", e)
    return false;
  }

}

/**
 * 
 * @param currentGame 
 * @returns 
 */
export const isOtherGamesEnded = async (currentGame: Game): Promise<boolean> => {
  try {
    let tournamentGames = await getActiveTournamentGames(currentGame.tableId, true);
    let result = true;
    for (let tournamentGame of tournamentGames) {
      if (tournamentGame.id != currentGame.id && !tournamentGame.ended) {
        result = false;
        break;
      }
    }
    return result;
  } catch (e) {
    console.log("err on IsOtherGamesEnded >> ", e);
    return false;
  }
}

/**
 * 
 * @param tournamentId 
 * @param player player wallet address
 * @returns true shows player already sits on the tournament
 */
export const canSitOnTournament = async (tournamentId: string, player: string): Promise<boolean> => {
  try {
    let tournamentGames = await getActiveTournamentGames(tournamentId, false);
    let tournament = await getTournamentById(tournamentId);
    if (!tournament || tournament && tournament.startAt && new Date().getTime() > new Date(tournament.startAt).getTime() || tournament.enterAt && new Date(tournament.enterAt).getTime() > new Date().getTime()) {
      return true;
    }

    let tournamentPlayers: Player[] = [];
    for (let tournamentGame of tournamentGames) {
      let gamePlayers = await getActivePlayers(tournamentGame.id);
      tournamentPlayers = [...tournamentPlayers, ...gamePlayers];
    }

    // check tournament is full
    if (tournamentPlayers.length >= tournament.totalSeats) {
      return true;
    }

    let existFlag = false;
    for (let tournamentPlayer of tournamentPlayers) {
      if (tournamentPlayer.address == player) {
        existFlag = true;
        break;
      }
    }
    return existFlag;
  } catch (e) {
    console.error("err on isSitOnTournament >> ", e);
    return true;
  }
}

/**
 * 
 * @param stack number 
 * @param buyIn number
 * @param minBet number 
 * @param numSeats number
 * @returns true shows tournament is already exists
 */
export const isTournamentExist = async (stack: number, buyIn: number, minBet: number, numSeats: number): Promise<boolean> => {
  try {
    let tournaments = await getTournamentsByQuery({
      initialStack: stack,
      buyIn: buyIn,
      minBet: minBet,
      totalSeats: numSeats,
      status: TournamentStatus.ACTIVE
    });
    if (tournaments.length > 0) {
      return true;
    } else {
      return false;
    }
  } catch (e) {
    console.log("err on isTournamentExist >> ", e);
    return true;
  }
}

