import { Game, GameMode } from "../types/Game";
import { Winner } from "../types/Winner";
import { logError } from "../utils/Error";
import { getKnex } from "../knex";
import { Player } from '../types/Player';
import { getActiveTournamentGames, getGameById, log } from "./games";
import { randomInt } from "crypto";

import { Server } from "socket.io";

import {
    ClientToServerEvents,
    InterServerEvents,
    ServerToClientEvents,
    SocketData,
} from "../utils/Socketio";
import { Action } from "../types/Action";
import { PlayerStreet } from "../types/Street";

const knex = getKnex();
const FIRST_HAND = 1;
export interface WinnersMap {
    [playerId: string]: Winner;
}

export const getPlayersFromGameId = async (gameId: string): Promise<Player[]> => {
    try {
        let players = await knex<Player>("players").select().where({ gameId: gameId });
        return players;
    } catch (e) {
        console.log("err on getPlayersFromGameId >> ", e);
        return []
    }
}

export const getActivePlayersFromGameId = async (gameId: string): Promise<Player[]> => {
    try {
        let players = await knex<Player>("players").select().where({ gameId: gameId, active: true });
        return players;
    } catch (e) {
        console.log("err on getPlayersFromGameId >> ", e);
        return []
    }
}


export const insertPlayer = async (args: Partial<Player>): Promise<Player | null> => {
    const [player] = await knex<Player>("players").insert(
        {
            ...args,
        },
        "*"
    );
    return player;
}


export async function updatePlayer(
    playerId: string,
    args: Partial<Player>
): Promise<void> {
    const knex = getKnex();
    // TODO: allow to update only specific fields
    await knex<Player>("players").update({ ...args }).where({ id: playerId });
}


export const sitOnGameTable = async (gameId: string, player: string, socketId: string): Promise<string | null> => {
    try {
        let game = await getGameById(gameId, GameMode.TOURNAMENT);
        if (!game) return null;
        let currentGamePlayers = await getActivePlayersFromGameId(gameId);
        if (currentGamePlayers.length < game.numSeats) {
            let seatIds = [];
            for (let curPlayer of currentGamePlayers) {
                seatIds.push(curPlayer.seatId)
            }

            let seatId = 0;
            for (let i = 1; i <= game.numSeats; i++) {
                if (!seatIds.includes(i)) {
                    seatId = i;
                    break;
                }
            }
            if (seatId == 0) {
                console.log("no valid seat exists in the current game")

                return null;
            } else {
                let insertedPlayer = await insertPlayer({
                    gameId,
                    address: player,
                    seatId: seatId,
                    socketId: socketId,
                    bet: 0,
                    folded: false,
                    stack: game.initialStack,
                    mode: GameMode.TOURNAMENT
                });
                if (insertedPlayer) {
                    return insertedPlayer.id;
                } else {
                    return null;
                }
            }
        } else {
            return null;
        }
    } catch (e) {
        console.log("err on sitOnGameTable", e);
        return null;
    }
}


export async function getActivePlayers(gameId: string): Promise<Player[]> {
    try {

        // TODO: we must return only the current player cards
        return await knex<Player>("players")
            .where({
                gameId,
                active: true,
            }).leftJoin("users", "users.address", "players.address")
            .orderBy("seatId", "asc");
    } catch (e) {
        logError("getPlayers", e);
        return [];
    }
}


export async function getActiveUnfoldedPlayers(gameId: string): Promise<Player[]> {
    const players = await getActivePlayers(gameId);
    return players.filter((p) => !p.folded);
}

export function resetPlayers(players: Player[]): void {
    for (const player of players) {
        player.bet = 0;
        player.cards = [];
        player.dealer = false;
        player.smallBlind = false;
        player.bigBlind = false;

        player.folded = false;
        player.lastStreet = PlayerStreet.INIT;
        if (player.lastAction != Action.AFK) player.lastAction = null;
    }
}


export async function chooseNextDealer(
    players: Player[],
    game: Game,
    currentDealer: string | null,
    io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): Promise<Player> {
    if (game.hand === FIRST_HAND) {
        const player = players[randomInt(players.length)];
        player.dealer = true;
        log(game.id, `Player ${player.id} was chosen as dealer`, io);
        return player;
    }
    if (currentDealer) {
        const player = await getNextPlayer(players, currentDealer);
        player.dealer = true;
        log(game.id, `Player ${player.id} was chosen as dealer`, io);
        return player;
    } else {
        // currentDealer is inactive
        // TODO: find the correct dealer
        throw new Error(
            "previous hand dealer is inactive, need to find a new dealer"
        );
    }
}



export async function getNextPlayer(
    players: Player[],
    currentPlayerId: string | null
): Promise<Player> {
    let nextPlayerIndex;
    if (!currentPlayerId) {
        nextPlayerIndex = 0;
    } else {
        const currentPlayerIndex = players.findIndex(
            (player) => player.id === currentPlayerId
        );
        if (players.length - 1 !== currentPlayerIndex) {
            nextPlayerIndex = currentPlayerIndex + 1;
        } else {
            nextPlayerIndex = 0;
        }
    }

    return players[nextPlayerIndex];
}


export async function getActiveUnfoldedPlayersWithCurrentPlayer(gameId: string, currentPlayerId: string | null): Promise<Player[]> {
    let query = '';
    if (currentPlayerId) {
        query = `
            select * from players where "gameId"='${gameId}' and active=true and folded=false or id='${currentPlayerId}' and "gameId"='${gameId}' order by "seatId" asc
        `
    } else {
        query = `
            select * from players where "gameId"='${gameId}' and active=true and folded=false order by "seatId" asc
        `
    }
    let result = await knex.raw(query);
    return result.rows as Player[];
}

export function isPlayerTurn(player: Player, game: Game): boolean {
    return game.currentPlayerId === player.id;
}

export function isActiveUnfoldedPlayer(player: Player): boolean {
    return player.active && !player.folded;
}

export function isAllIn(player: Player): boolean {
    return player.stack === 0;
}


export async function getPlayerBySocketId(
    gameId: string,
    socketId: string
): Promise<Player | null> {
    try {
        const [player] = await knex<Player>("players").where({
            gameId,
            socketId,
            active: true
        });
        return player;
    } catch (e) {
        return null;
    }
}

export const getTournamentPlayersOrderByUpdatedTime = async (tournamentId: string, exceptPlayers: Player[], limit = 0): Promise<Player[]> => {
    try {

        let exceptPlayerIds: string[] = [];
        exceptPlayers.map((player) => {
            exceptPlayerIds.push(player.id)
        })
        console.log("except players ", exceptPlayerIds);

        let games = await getActiveTournamentGames(tournamentId, true);
        if (games && games.length > 0) {
            let players: Player[] = [];
            for (let i = 0; i < games.length; i++) {
                let _players = await getPlayersFromGameId(games[i].id);
                players = [...players, ..._players];
            }
            if (limit == 0) return players.filter(player => !exceptPlayers.includes(player)).sort((a, b) => { return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() });
            else {

                return players.filter(player => !exceptPlayerIds.includes(player.id)).sort((a, b) => { return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() }).slice(0, limit);
            }
        } else {
            return [];
        }

    } catch (e) {
        console.log("err on getGamePlayersByGameId", e);
        return []
    }
}