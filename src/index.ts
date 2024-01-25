import express from "express";
import dotenv from "dotenv";
import { getKnex } from "./knex";
import { logError } from "./utils/Error";
import bp from "body-parser";
import { Server } from "socket.io";
import { createServer } from "http";
import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./utils/Socketio";
import { BlindIncreaseModes, Table } from "./types/Table";
import { Player } from "./types/Player";
import { Action } from "./types/Action";
import { Game, GameMode } from "./types/Game";
//@ts-ignore-next-line
import { Hand } from "pokersolver";
import { sleep } from "./utils/util";
import { web3 } from "@project-serum/anchor";
import * as anchor from "@project-serum/anchor";

import fs from "fs";
import path from "path";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
// import { IDL as BonesPokerIDL } from "./context/bones_poker_contract";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
  userLeaveTableOnChain,
  userLeaveTableWithTokenOnChain,
  userLeaveTournament,
  userLeaveTournamentWithToken,
} from "./context/scripts"; //
import { AUTO_START_TIME, SOL_ADDRESS } from "./context/types";
import { getUserProfileData, saveUserProfileData } from "./mng/user";
import { getTable, getTableNameFromId } from "./mng/tables";
import {
  getActiveTournaments,
  insertTournament,
  isActiveTournament,
  canSitTournament,
  isFullTournament,
  sitTournament,
  getTournamentPlayers,
  getTournamentById,
  startTournament,
  canSitOnTournament,
  updateTournament,
} from "./mng/tournaments";

import schedule from "node-schedule";

const cluster = (process.env.SOLANA_NETWORK as web3.Cluster) || "devnet";
let solConnection = new web3.Connection(web3.clusterApiUrl(cluster));

// const RPC = "https://neat-dry-patron.solana-mainnet.quiknode.pro/49a414d786b7497bca9f7f09df812df6d458c929";
// let solConnection = new web3.Connection(RPC);

const BE_WALLET_ADDRESS =
  process.env.BE_WALLET || "./src/context/BP-BE-devnet.json";
const walletKeypair = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(fs.readFileSync(path.resolve(BE_WALLET_ADDRESS), "utf-8"))
  ),
  { skipValidation: true }
);
const wallet = new NodeWallet(walletKeypair);
// anchor.setProvider(anchor.AnchorProvider.local(web3.clusterApiUrl(cluster)));
// Configure the client to use the local cluster.
anchor.setProvider(
  new anchor.AnchorProvider(solConnection, wallet, {
    skipPreflight: true,
    commitment: "confirmed",
  })
);

import {
  getActivePlayers,
  getActiveUnfoldedPlayers,
  insertPlayer,
  updatePlayer,
} from "./mng/players";
import {
  allIn,
  call,
  canRejoinGameFromAfk,
  changeTurn,
  check,
  fold,
  getExistingGames,
  getGame,
  getGameById,
  getRoomName,
  getSeats,
  getValidAfkGames,
  insertGame,
  leave,
  log,
  notifySeatsUpdated,
  raise,
  rejoinGameFromAfk,
  showdown,
  startGame,
} from "./mng/games";
import {
  getDailyRankData,
  getMonthlyRankData,
  recordAction,
} from "./mng/history";
import { getCommunityCards } from "./mng/cards";
import { Tournament, TournamentStatus } from "./types/Tournament";
import {
  deleteToken,
  deleteTokenIsPossible,
  getTokenByAddress,
  getTokenById,
  getTokenList,
  insertToken,
  isTokenExist,
  updateToken,
} from "./mng/tokens";
import { TemplateTable } from "./types/UI";
import { PlayerStreet } from "./types/Street";

const knex = getKnex();

const app = express();
app.use(bp.json());
dotenv.config();

app.get("/", async (req, res) => {
  console.log(req.body);
  res.send("server is running...");
});

const port = process.env.PORT || 4001;
const httpServer = createServer(app).listen(port, async () => {
  console.log(`Listening on port ${port}`);

  // let communityCards = ["KC", "6D", "QH", "7H", "AH"];
  // let players = [["3C", "4D"], ["2C", "4S"]];
  // let playerCards = players.map((p) => Hand.solve(getSolverCards([...p])));
  // let winnersSet = new Set<any>(Hand.winners(playerCards));
  // // console.log("players ", playerCards)

  // let winners = Hand.winners(playerCards);
  // console.log("length ", winners.length);

  // // console.log("cardPool ", winners[0].cardPool);
  // // console.log("cards ", winners[0].cards)
  // // console.log("suits ", winners[0].suits)
  // // console.log("values ", winners[0].values);

  // console.log("winners ", winners);

  // console.log("winner map ", winnersSet);
  // console.log("......................................................")
  // console.log("player 1 ", playerCards[0])
  // console.log("player 1 exists ", winnersSet.has(playerCards[0]))

  // console.log("......................................................")
  // console.log("player 1 ", playerCards[1])
  // console.log("player 2 exists ", winnersSet.has(playerCards[1]))

  let activeTournaments = await getActiveTournaments();
  for (let i = 0; i < activeTournaments.length; i++) {
    let tournament = activeTournaments[i];
    if (
      !tournament.startAt ||
      new Date(tournament.startAt).getTime() <= new Date().getTime()
    ) {
      continue;
    } else {
      let startAt = new Date(tournament.startAt);
      schedule.scheduleJob(startAt, async () => {
        await startTournament(tournament.id, io);
      });
    }
  }
});

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer);

io.on("connection", (socket) => {
  console.log("connected socket " + socket.id);

  socket.on("updateToken", async (id, name, address, decimal, callback) => {
    try {
      await updateToken(id, { name: name, address: address, decimal: decimal });
      let tokenList = await getTokenList();

      callback(true, tokenList);
    } catch (e) {
      console.log("err on updateToken ", e);
      callback(false, []);
    }
  });

  socket.on("deleteTokenIsPossible", async (name, address, callback) => {
    try {
      let result = await deleteTokenIsPossible({
        name: name,
        address: address,
      });
      callback(result);
    } catch (e) {
      console.log("err on deleteTokenIsPossible ", e);
      callback(false);
    }
  });

  socket.on("deleteToken", async (name, address, callback) => {
    try {
      let result = await deleteTokenIsPossible({
        name: name,
        address: address,
      });

      if (result) {
        await deleteToken({ name: name, address: address });
      }

      let tokenList = await getTokenList();
      if (result) callback(true, tokenList);
      else callback(false, tokenList);
    } catch (e) {
      console.log("err on deleteToken ", e);
      callback(false, []);
    }
  });

  socket.on("addNewToken", async (name, address, decimal, callback) => {
    try {
      let result = await isTokenExist({ address: address });
      if (!result) {
        await insertToken({ name: name, address: address, decimal: decimal });
      }

      let tokenList = await getTokenList();
      callback(!result, tokenList);
    } catch (e) {
      console.log("err on addNewToken ", e);
      callback(false, []);
    }
  });

  socket.on("getTokenList", async (callback) => {
    try {
      let tokenList = await getTokenList();
      callback(tokenList);
    } catch (e) {
      console.log("err on getTokenList ", e);
      callback([]);
    }
  });

  socket.on("getLeaderboardData", async (callback) => {
    try {
      let dailyRankData = await getDailyRankData();
      let monthlyRankData = await getMonthlyRankData();
      callback(dailyRankData, monthlyRankData);
    } catch (e) {
      console.log(e);
      callback([], []);
    }
  });

  socket.on("getPreviousGameWinners", async (gameId, callback) => {
    try {
      if (!gameId) {
        callback(null, null);
        return;
      }
      const game = await getGame(gameId);
      if (!game) {
        callback(null, null);
        return;
      }
      callback(game.winners, game.prevCommunityCards);
    } catch (e) {
      console.log(e);
      callback(null, null);
    }
  });

  socket.on("getExistingTournaments", async (callback) => {
    try {
      let data = await getActiveTournaments();
      callback(data);
    } catch (e) {
      console.log(e);
      callback(null);
    }
  });

  socket.on(
    "saveUserProfileData",
    async (address, userName, userPfp, callback) => {
      try {
        if (!address || !userName || !userPfp) {
          callback(false);
          return;
        }

        let result = await saveUserProfileData(address, {
          name: userName,
          pfp: userPfp,
        });
        if (result) {
          callback(true);
        } else {
          callback(false);
        }
      } catch (e) {
        logError("saveUserProfileData", e);
        callback(false);
      }
    }
  );

  socket.on("getUserProfileData", async (address, callback) => {
    try {
      if (!address) {
        callback(null);
        return;
      }
      let data = await getUserProfileData(address);
      callback(data);
    } catch (e) {
      logError("getUserProfileData", e);
      callback(null);
    }
  });

  socket.on("getExistingGames", async (callback) => {
    try {
      let data = await getExistingGames();
      callback(data);
    } catch (e) {
      logError("createGame", e);
      callback(null);
    }
  });

  socket.on("createGame", async (tableId, callback) => {
    try {
      // const name = "dummy table";
      // const numSeats = 10;
      // const initialStack = 100;
      // const minBet = 20;
      // const table = await insertTable({ name, numSeats, initialStack, minBet });
      const table = await getTable(tableId);
      if (!table) {
        callback(null);
        return;
      }
      const game = await insertGame({
        tableId,
        numSeats: table.numSeats,
        minBet: table.minBet,
        initialStack: table.initialStack,
        buyIn: table.buyIn,
        blindIncreaseMode: table.blindIncreaseMode,
        blindIncreaseTime: table.blindIncreaseTime,
        blindIncreaseRound: table.blindIncreaseRound,
        blindIncreaseMulti: table.blindIncreaseMulti,
      });
      callback(game ? game.id : null);
    } catch (e) {
      logError("createGame", e);
      callback(null);
    }
  });

  socket.on("isSitOnGame", async (gameId, player, callback) => {
    try {
      console.log("player trying to sit...", gameId, player);

      if (!gameId || !player) {
        callback(true);
        return;
      }

      const game = await getGame(gameId);

      let existingCurrentPlayer = await knex<Player>("players")
        .select()
        .where({ gameId, address: player, active: true });
      let gamePlayers = await knex<Player>("players")
        .select()
        .where({ gameId, active: true });
      if (
        !game ||
        game.startedAt ||
        (existingCurrentPlayer && existingCurrentPlayer.length > 0) ||
        gamePlayers.length >= game.numSeats
      ) {
        // true => already exist
        console.log("player already entered");
        callback(true);
        return;
      } else {
        callback(false);
        return;
      }
    } catch (e) {
      console.log(e);
      callback(true);
    }
  });

  socket.on("isSitOnTournament", async (tournamentId, player, callback) => {
    try {
      console.log(
        `player ${player} is trying to sit on tournament `,
        tournamentId
      );
      if (!tournamentId || !player) {
        callback(true);
        return;
      }
      let exist = await canSitOnTournament(tournamentId, player);
      callback(exist);
    } catch (e) {
      console.log(e);
      callback(true);
    }
  });

  socket.on(
    "sitTournament",
    async (tournamentId, playerWallet, txId, callback) => {
      try {
        if (
          tournamentId &&
          playerWallet &&
          (await isActiveTournament(tournamentId)) &&
          (await canSitTournament(tournamentId, playerWallet)) &&
          !(await isFullTournament(tournamentId))
        ) {
          let tournament = await getTournamentById(tournamentId);

          if (!tournament) {
            console.log("invalid tournament ", tournament);
            callback(null, null);
            return;
          }

          let txInfo = await solConnection.getParsedTransaction(txId);
          let slot = await solConnection.getSlot();
          let startTime = await solConnection.getBlockTime(slot);
          if (!startTime) {
            callback(null, null);
            return;
          }

          do {
            if (!txInfo) {
              await sleep(3000);
              txInfo = await solConnection.getParsedTransaction(txId);
              let slot = await solConnection.getSlot();
              let endTime = await solConnection.getBlockTime(slot);
              if (!endTime) {
                callback(null, null);
                return;
              }

              if (endTime - startTime > 120) {
                break;
              }
            } else {
              break;
            }
          } while (true);
          if (!txInfo) {
            console.log("txinfo catching failed on sitTournament...");
            callback(null, null);
            return;
          }
          if (
            !txInfo.meta?.err &&
            txInfo.transaction.message.accountKeys[0].signer &&
            txInfo.transaction.message.accountKeys[0].pubkey.toBase58() ==
              playerWallet
          ) {
            let txTime = txInfo.blockTime;
            if (
              !txTime ||
              startTime - txTime > 120 ||
              !txInfo.meta?.preBalances
            ) {
              console.log("entert tx timestamp invalid || no balance change");
              callback(null, null);
              return;
            }
            let payToken = await getTokenById(tournament.payToken);
            if (!payToken) {
              console.log("invalid token");
              callback(null, null);
              return;
            }

            if (payToken.address == SOL_ADDRESS) {
              let solChange =
                txInfo.meta?.preBalances[0] - txInfo.meta?.postBalances[0];
              console.log(solChange);
              console.log(tournament.buyIn);
              console.log(txInfo.meta.fee);
              if (solChange !== tournament.buyIn + txInfo.meta.fee) {
                console.log("invalid enter fee.");
                callback(null, null);
                return;
              }
            } else {
              if (
                txInfo.meta?.preTokenBalances &&
                txInfo.meta?.postTokenBalances &&
                txInfo.meta?.preTokenBalances[0].uiTokenAmount.amount &&
                txInfo.meta?.postTokenBalances[0].uiTokenAmount.amount
              ) {
                console.log(
                  txInfo.meta?.preTokenBalances[0].uiTokenAmount.uiAmount
                );
                console.log(
                  txInfo.meta?.postTokenBalances[0].uiTokenAmount.amount
                );
                console.log(tournament.buyIn);
                console.log(payToken.decimal);
                let tokenChange =
                  parseInt(
                    txInfo.meta?.postTokenBalances[0].uiTokenAmount.amount
                  ) -
                  parseInt(
                    txInfo.meta?.preTokenBalances[0].uiTokenAmount.amount
                  );
                console.log(tokenChange);
                console.log(tournament.buyIn);
                if (tokenChange != tournament.buyIn) {
                  callback(null, null);
                  return;
                }
              } else {
                callback(null, null);
                return;
              }
            }

            let exist = await canSitOnTournament(tournamentId, playerWallet);
            if (exist) {
              callback(null, null);
              if (payToken?.address == SOL_ADDRESS) {
                await userLeaveTournament(
                  tournament.initialStack,
                  tournament.buyIn,
                  tournament.minBet,
                  tournament.totalSeats,
                  new PublicKey(playerWallet)
                );
              } else if (payToken?.address) {
                await userLeaveTournamentWithToken(
                  tournament.initialStack,
                  tournament.buyIn,
                  tournament.minBet,
                  tournament.totalSeats,
                  new PublicKey(playerWallet),
                  new PublicKey(payToken?.address)
                );
              }
              return;
            }

            let [gameId, playerId] = await sitTournament(
              tournamentId,
              playerWallet,
              socket.id
            );

            if (!gameId) {
              console.log("invalid gameId ", gameId);
              callback(null, null);
              return;
            }
            const room = getRoomName(gameId);
            socket.join(room);

            let tournamentPlayers = await getTournamentPlayers(tournamentId);

            callback(
              playerId,
              gameId,
              tournamentPlayers.length == tournament.totalSeats
            );

            let existingTournaments = await getActiveTournaments();
            // io.emit("activeTournamentUpdated", existingTournaments);
            const game = await getGame(gameId);
            if (!game) {
              return;
            }
            await sleep(5000);
            const gamePlayers = await getActiveUnfoldedPlayers(gameId);
            await notifySeatsUpdated(gamePlayers, game, io);

            if (tournamentPlayers.length == tournament.totalSeats) {
              // await startTournament(tournament.id, io);
              await schedule.gracefulShutdown();

              Promise.all(
                existingTournaments.map(async (tournament: Tournament) => {
                  if (
                    tournament &&
                    tournament.startAt &&
                    tournament.id != tournamentId
                  ) {
                    let startAt = new Date(tournament?.startAt);
                    schedule.scheduleJob(startAt, async () => {
                      await startTournament(tournament.id, io);
                    });
                  }
                })
              );
              await startTournament(tournament.id, io);
            } else {
            }
          } else {
            callback(null, null);
            return;
          }
        } else {
          console.log("tournament expired...");
          callback(null, null);
        }
      } catch (e) {
        console.log("err on sitTournament >> ", e);
        callback(null, null);
      }
    }
  );

  socket.on("sitOnGame", async (gameId, txId, player, callback) => {
    try {
      if (!player) {
        callback(null);
        return;
      }

      // TODO: handle reconnect
      const game = await getGame(gameId);

      if (!game || (game && game.startedAt)) {
        console.log("game does not exist || game already started");
        callback(null);
        return;
      }
      let txInfo = await solConnection.getParsedTransaction(txId, "finalized");

      let slot = await solConnection.getSlot();
      let startTime = await solConnection.getBlockTime(slot);
      if (!startTime) {
        callback(null);
        return;
      }
      //let startTime =  Math.floor(new Date().getTime() / 1000);
      do {
        if (txInfo === null) {
          await sleep(3000);
          console.log("catching transaction retry... for sig: ", txId);
          txInfo = await solConnection.getParsedTransaction(txId, "finalized");
          let slot = await solConnection.getSlot();
          let endTime = await solConnection.getBlockTime(slot);
          if (!endTime) {
            callback(null);
            return;
          }
          // let endTime = Math.floor(new Date().getTime() / 1000);
          if (endTime - startTime > 120) {
            break;
          }
        } else {
          break;
        }
      } while (true);
      // console.log(txInfo)

      if (!txInfo) {
        console.log("sit tx Info getting failed.");
        callback(null);
        return;
      }

      if (
        !txInfo.meta?.err &&
        txInfo.transaction.message.accountKeys[0].signer &&
        txInfo.transaction.message.accountKeys[0].pubkey.toBase58() == player
      ) {
        // console.log(txInfo.blockTime)
        // console.log(startTime);

        let txTime = txInfo.blockTime;

        if (
          !txTime ||
          (txTime && startTime - txTime > 120) ||
          !txInfo.meta?.preBalances
        ) {
          console.log("entert tx timestamp invalid || no balance change");
          callback(null);
          return;
        }
        let payToken = await getTokenById(game.payToken);
        if (!payToken) {
          console.log("invalid token");
          callback(null);
          return;
        }

        if (payToken.address == SOL_ADDRESS) {
          let solChange =
            txInfo.meta?.preBalances[0] - txInfo.meta?.postBalances[0];
          if (solChange !== game.buyIn + txInfo.meta.fee) {
            console.log("invalid enter fee.");
            callback(null);
            return;
          }
        } else {
          if (
            txInfo.meta?.preTokenBalances &&
            txInfo.meta?.postTokenBalances &&
            txInfo.meta?.preTokenBalances[0].uiTokenAmount.amount &&
            txInfo.meta?.postTokenBalances[0].uiTokenAmount.amount
          ) {
            console.log(
              txInfo.meta?.preTokenBalances[0].uiTokenAmount.uiAmount
            );
            console.log(txInfo.meta?.postTokenBalances[0].uiTokenAmount.amount);
            console.log(game.buyIn);
            console.log(payToken.decimal);
            let tokenChange =
              parseInt(txInfo.meta?.postTokenBalances[0].uiTokenAmount.amount) -
              parseInt(txInfo.meta?.preTokenBalances[0].uiTokenAmount.amount);
            console.log(tokenChange);
            console.log(game.buyIn);
            if (tokenChange != game.buyIn) {
              callback(null);
              return;
            }
          } else {
            callback(null);
            return;
          }
        }

        let playerInfo = await knex<Player>("players")
          .select()
          .where({ address: player, gameId, active: true });
        if (playerInfo.length > 0) {
          console.log("player is already existing in the game");

          // player is already exists in the current game
          callback(null);
          return;
        } else {
          let currentGamePlayers = await knex<Player>("players")
            .select()
            .where({
              gameId,
              active: true,
            });
          if (currentGamePlayers.length < game.numSeats) {
            let seatIds = [];
            for (let curPlayer of currentGamePlayers) {
              seatIds.push(curPlayer.seatId);
            }
            let seatId = 0;
            for (let i = 1; i <= game.numSeats; i++) {
              if (!seatIds.includes(i)) {
                seatId = i;
                break;
              }
            }
            if (seatId == 0) {
              console.log("no valid seat exists in the current game");
              callback(null);
              return;
            } else {
              await insertPlayer({
                gameId,
                address: player,
                seatId: seatId,
                socketId: socket.id,
                bet: 0,
                folded: false,
                stack: game.initialStack,
              });
            }
          } else {
            console.log("game table is full with players");
            if (payToken?.address == SOL_ADDRESS) {
              userLeaveTableOnChain(
                game.initialStack,
                game.buyIn,
                game.minBet,
                game.numSeats,
                new PublicKey(player)
              );
            } else if (payToken?.address) {
              userLeaveTableWithTokenOnChain(
                game.initialStack,
                game.buyIn,
                game.minBet,
                game.numSeats,
                new PublicKey(player),
                new PublicKey(payToken.address)
              );
            }

            callback(null);
            return;
          }
          playerInfo = await knex<Player>("players")
            .select()
            .where({ address: player, gameId, active: true });
          // reply to current player
          const room = getRoomName(gameId);
          socket.join(room);
          //
          const players = await getActiveUnfoldedPlayers(gameId);
          callback(playerInfo[0].id, players.length == game.numSeats);
          await sleep(5000);
          await notifySeatsUpdated(players, game, io);

          if (players.length == game.numSeats) {
            // start game automatically

            await startGame(game, io);
          } else {
            setTimeout(async () => {
              let nextGamePlayers = await knex<Player>("players")
                .select()
                .where({
                  gameId,
                  //active: true,
                });

              let leaveUser = playerInfo[0];
              // check player is still on the table.
              let nextActivePlayer = await knex<Player>("players")
                .select()
                .where({
                  gameId,
                  id: leaveUser.id,
                  active: true,
                });

              if (
                nextGamePlayers.length == currentGamePlayers.length + 1 &&
                nextGamePlayers.length > 1
              ) {
                console.log(`gameId : ${gameId} auto starting...`);
                await startGame(game, io);

                let existingGames = await getExistingGames();
                io.emit("activeGameUpdated", existingGames);
              } else if (
                nextGamePlayers.length == currentGamePlayers.length + 1 &&
                nextActivePlayer.length == 1
              ) {
                console.log("auto-leaving with timeout...");

                if (payToken?.address == SOL_ADDRESS) {
                  userLeaveTableOnChain(
                    game.initialStack,
                    game.buyIn,
                    game.minBet,
                    game.numSeats,
                    new PublicKey(player)
                  );
                } else if (payToken?.address) {
                  userLeaveTableWithTokenOnChain(
                    game.initialStack,
                    game.buyIn,
                    game.minBet,
                    game.numSeats,
                    new PublicKey(player),
                    new PublicKey(payToken.address)
                  );
                }
                console.log("address and gameId >>> ", player, gameId);

                // ====================
                await recordAction({
                  gameId: game.id,
                  socketId: leaveUser.socketId,
                  playerId: leaveUser.id,
                  action: Action.LEAVE,
                  bet: game.bet,
                });
                leaveUser.lastAction = Action.LEAVE;
                leaveUser.active = false;
                leaveUser.bet = 0;
                await updatePlayer(leaveUser.id, {
                  bet: leaveUser.bet,
                  lastAction: leaveUser.lastAction,
                  active: leaveUser.active,
                  seatId: 0,
                  lastStreet: PlayerStreet.INIT,
                });
                console.log(`updated playerId ${leaveUser.id} to deactive.`);
                log(gameId, `${leaveUser.id} LEAVE`, io);
                // ====================

                // await knex.raw(`delete from players where "gameId"='${gameId}' and id='${player.id}'`)
                const players = await getActiveUnfoldedPlayers(gameId);

                console.log(`active players : ${players.length}`);

                await notifySeatsUpdated(players, game, io);

                //game list update
                let existingGames = await getExistingGames();
                io.emit("activeGameUpdated", existingGames);
              }
            }, AUTO_START_TIME);
          }
          // get active games and broadcast
          // update joiable gamelist to clients
          let existingGames = await getExistingGames();
          io.emit("activeGameUpdated", existingGames);
        }
      } else {
        callback(null);
        return;
      }

      // const player = await insertPlayer({
      //   gameId,
      //   seatId,
      //   socketId: socket.id,
      //   bet: 0,
      //   folded: false,
      // });
    } catch (e) {
      // ignore error
      console.log(e);
      callback(null);
    }
  });

  socket.on("viewTable", async (gameId, callback) => {
    try {
      const game = await getGame(gameId);
      if (!game) {
        callback(
          {},
          false,
          0,
          [],
          null,
          0,
          0,
          0,
          [],
          "",
          0,
          0,
          0,
          BlindIncreaseModes.ROUND,
          1,
          0,
          2,
          0,
          null,
          null
        );
        return;
      }

      const players = await getActiveUnfoldedPlayers(gameId);
      const seats = await getSeats(game);
      const communityCards = game ? getCommunityCards(game) : [];

      let tableName = await getTableNameFromId(game.tableId);
      // TODO: don't hardcode the return values, get them from getBigBlindBet() and getSmallBlindBet()
      let totalBettedPlayers = (
        await knex.raw(`
      select * from players where "gameId" = '${gameId}' and "seatId" != 0 
      `)
      ).rows.length;
      let initStack = game.initialStack;
      // let numSeats = game.numSeats;
      let buyIn = game.buyIn;
      let countdownStartValue = 0;
      let lastUpdatedTime = new Date("2000-01-01T00:00:00.000Z").getTime();
      let activePlayers = await getActivePlayers(gameId);
      for (let activePlayer of activePlayers) {
        if (lastUpdatedTime < new Date(activePlayer.updatedAt).getTime()) {
          lastUpdatedTime = new Date(activePlayer.updatedAt).getTime();
        }
      }
      countdownStartValue = Math.floor(
        (new Date().getTime() - lastUpdatedTime) / 1000
      );
      let rewardPlan = null;
      if (game.mode == GameMode.TOURNAMENT) {
        totalBettedPlayers = (await getTournamentPlayers(game.tableId)).filter(
          (player) => player.seatId != 0
        ).length;

        let tournament = await getTournamentById(game.tableId);
        if (tournament) {
          rewardPlan = tournament.rewardPlan;
        }
      }

      let payToken = await getTokenById(game.payToken);

      callback(
        seats,
        Boolean(game.startedAt),
        players.length,
        game.pots,
        game.winners,
        0,
        game.minBet,
        game.minBet / 2,
        communityCards,
        tableName,
        initStack,
        totalBettedPlayers,
        buyIn,
        game.blindIncreaseMode,
        game.blindIncreaseRound,
        game.blindIncreaseTime,
        game.blindIncreaseMulti,
        countdownStartValue,
        payToken,
        rewardPlan
      );
    } catch (e) {
      console.log(e);
      callback(
        {},
        false,
        0,
        [],
        null,
        0,
        0,
        0,
        [],
        "",
        0,
        0,
        0,
        BlindIncreaseModes.ROUND,
        1,
        0,
        2,
        0,
        null,
        null
      );
    }
  });

  socket.on(
    "isTableExist",
    async (
      editInitialStack,
      editBuyIn,
      editMinBet,
      editNumSeats,
      payTokenAddress,
      callback
    ) => {
      try {
        console.log(
          editNumSeats,
          editMinBet,
          editInitialStack,
          editBuyIn,
          payTokenAddress
        );
        if (
          !editNumSeats ||
          !editMinBet ||
          !editInitialStack ||
          !editBuyIn ||
          !payTokenAddress
        ) {
          callback(false);
          return;
        }
        let token = await getTokenByAddress(payTokenAddress);

        if (!token) {
          callback(false);
          return;
        }

        let tables = await knex<Table>("tables").select().where({
          numSeats: editNumSeats,
          initialStack: editInitialStack,
          minBet: editMinBet,
          buyIn: editBuyIn,
          status: true,
          payToken: token.id,
        });
        // console.log(tables)
        // console.log(editNumSeats, editMinBet, editInitialStack, editBuyIn)
        if (tables.length >= 1) {
          callback(true);
        } else {
          callback(false);
        }
        return;
      } catch (e) {
        console.log(e);
        callback(false);
        return;
      }
    }
  );

  socket.on(
    "addNewTable",
    async (
      editName,
      editNumSeats,
      editMinBet,
      editInitialStack,
      editBuyIn,
      blindIncreaseMode,
      blindIncreaseRound,
      blindIncreaseTime,
      tokenId,
      callback
    ) => {
      try {
        if (
          editNumSeats % 1 === 0 &&
          editNumSeats % 1 === 0 &&
          editNumSeats % 1 === 0 &&
          editNumSeats % 1 === 0 &&
          (blindIncreaseRound != 0 || blindIncreaseTime != 0) &&
          (blindIncreaseMode == "time" || blindIncreaseMode == "round")
        ) {
          let _blindIncreaseMode =
            blindIncreaseMode == "round"
              ? BlindIncreaseModes.ROUND
              : BlindIncreaseModes.TIME;
          const [table] = await knex<Table>("tables").insert(
            {
              name: editName,
              numSeats: editNumSeats,
              minBet: editMinBet,
              initialStack: editInitialStack,
              buyIn: editBuyIn,
              blindIncreaseMode: _blindIncreaseMode,
              blindIncreaseTime: blindIncreaseTime,
              blindIncreaseRound,
              status: true,
              payToken: tokenId,
            },
            "*"
          );

          // console.log(table)

          if (table && table.id) {
            await insertGame({
              tableId: table.id,
              numSeats: table.numSeats,
              minBet: table.minBet,
              initialStack: table.initialStack,
              buyIn: table.buyIn,
              blindIncreaseMode: table.blindIncreaseMode,
              blindIncreaseTime: table.blindIncreaseTime,
              blindIncreaseRound: table.blindIncreaseRound,
              blindIncreaseMulti: table.blindIncreaseMulti,
              payToken: tokenId,
            });
            let existingGames = await getExistingGames();
            io.emit("activeGameUpdated", existingGames);
          }
        } else {
          console.log(
            "inputed value invalid",
            editName,
            editNumSeats,
            editMinBet,
            editInitialStack,
            editBuyIn
          );
        }
        const tables = await knex<TemplateTable>("tables")
          .select("tables.*")
          .select({
            payToken: "tokens.id",
            payTokenName: "tokens.name",
            payTokenAddress: "tokens.address",
            payTokenDecimal: "tokens.decimal",
          })
          .where({ status: true })
          .leftJoin("tokens", "tables.payToken", "tokens.id");

        callback(tables);
      } catch (e) {
        console.log(e);
        callback([]);
      }
    }
  );

  socket.on(
    "addNewTournament",
    async (
      editName,
      editTournamentNumSeats,
      editNumSeats,
      editMinBet,
      editInitialStack,
      editBuyIn,
      blindIncreaseMode,
      blindIncreaseRound,
      blindIncreaseTime,
      editTournamentEnterAt,
      editTournamentStartAt,
      tokenId,
      rewardPlan,
      callback
    ) => {
      try {
        if (
          editName &&
          editName.trim() != "" &&
          editNumSeats % 1 === 0 &&
          editTournamentNumSeats % 1 === 0 &&
          (editTournamentNumSeats / editNumSeats) % 1 === 0 &&
          (blindIncreaseRound != 0 || blindIncreaseTime != 0) &&
          (blindIncreaseMode == "time" || blindIncreaseMode == "round") &&
          editTournamentEnterAt &&
          editTournamentStartAt &&
          tokenId
        ) {
          let _blindIncreaseMode =
            blindIncreaseMode == "round"
              ? BlindIncreaseModes.ROUND
              : BlindIncreaseModes.TIME;
          const tournament = await insertTournament({
            name: editName,
            totalSeats: editTournamentNumSeats,
            tableSeats: editNumSeats,
            minBet: editMinBet,
            initialStack: editInitialStack,
            buyIn: editBuyIn,
            blindIncreaseMode: _blindIncreaseMode,
            blindIncreaseTime: blindIncreaseTime,
            blindIncreaseRound,
            enterAt: new Date(editTournamentEnterAt),
            startAt: new Date(editTournamentStartAt),
            status: TournamentStatus.ACTIVE,
            payToken: tokenId,
            // @ts-ignore-next-line
            rewardPlan: JSON.stringify(rewardPlan),
          });
          if (!tournament) {
            callback([]);
            return;
          }

          let startAt = new Date(editTournamentStartAt);
          schedule.scheduleJob(startAt, async () => {
            await startTournament(tournament.id, io);
          });

          // console.log(table)

          if (tournament && tournament.id) {
            for (
              let i = 0;
              i < tournament.totalSeats / tournament.tableSeats;
              i++
            ) {
              await insertGame({
                tableId: tournament.id,
                numSeats: tournament.tableSeats,
                minBet: tournament.minBet,
                initialStack: tournament.initialStack,
                buyIn: tournament.buyIn,
                blindIncreaseMode: tournament.blindIncreaseMode,
                blindIncreaseTime: tournament.blindIncreaseTime,
                blindIncreaseRound: tournament.blindIncreaseRound,
                blindIncreaseMulti: tournament.blindIncreaseMulti,
                mode: GameMode.TOURNAMENT,
                payToken: tournament.payToken,
              });
            }
            let existingTournaments = await getActiveTournaments();
            io.emit("activeTournamentUpdated", existingTournaments);
          }
        } else {
          console.log(
            "inputed value invalid",
            editName,
            editNumSeats,
            editMinBet,
            editInitialStack,
            editBuyIn
          );
        }
        let tournaments = await getActiveTournaments();
        callback(tournaments);
      } catch (e) {
        console.log("error on addNewTournament", e);
        callback([]);
      }
    }
  );

  socket.on(
    "deleteTable",
    async (
      id,
      name,
      numSeats,
      editMinBet,
      editInitialStack,
      editBuyIn,
      payTokenId,
      callback
    ) => {
      try {
        if (
          !id ||
          id == "" ||
          !name ||
          !numSeats ||
          !editMinBet ||
          !editInitialStack ||
          !editBuyIn ||
          !payTokenId
        ) {
          const tables2 = await knex<TemplateTable>("tables")
            .select()
            .where({ status: true });
          callback(tables2);
          return;
        } else {
          // console.log(id, name, numSeats, editMinBet, editInitialStack, editBuyIn);

          // await knex<Player>("tables").update(player).where({ id: playerId });
          // let result = await knex.delete("tables").where({ id: id });
          let query = `update tables set status=false where id='${id}'`;
          let result = await knex.raw(query);
          console.log(result);
        }
        let existingGames = await getExistingGames();
        io.emit("activeGameUpdated", existingGames);

        const tables = await knex<TemplateTable>("tables")
          .select("tables.*")
          .select({
            payToken: "tokens.id",
            payTokenName: "tokens.name",
            payTokenAddress: "tokens.address",
            payTokenDecimal: "tokens.decimal",
          })
          .where({ status: true })
          .leftJoin("tokens", "tables.payToken", "tokens.id");
        callback(tables);
      } catch (e) {
        console.log(e);
        callback([]);
      }
    }
  );

  socket.on(
    "deleteTournament",
    async (
      id,
      name,
      numSeats,
      editMinBet,
      editInitialStack,
      editBuyIn,
      callback
    ) => {
      try {
        if (
          !id ||
          id == "" ||
          !name ||
          !numSeats ||
          !editMinBet ||
          !editInitialStack ||
          !editBuyIn
        ) {
          const activeTournaments = await getActiveTournaments();
          callback(activeTournaments);
          return;
        } else {
          // console.log(id, name, numSeats, editMinBet, editInitialStack, editBuyIn);

          // await knex<Player>("tables").update(player).where({ id: playerId });
          // let result = await knex.delete("tables").where({ id: id });
          await updateTournament(id, {
            status: TournamentStatus.INACTIVE,
          });
        }

        const activeTournaments = await getActiveTournaments();
        callback(activeTournaments);
        io.emit("activeTournamentUpdated", activeTournaments);
      } catch (e) {
        console.log(e);
        callback([]);
      }
    }
  );

  // socket.on("startGame", async (gameId) => {
  //   try {
  //     const game = await getGame(gameId);
  //     if (!game) return;
  //     game.startedAt = new Date();
  //     await updateGame(game.id, {
  //       startedAt: game.startedAt,
  //     });
  //     const room = getRoomName(game.id);
  //     io.to(room).emit("gameStarted");
  //     log(game.id, "Game started");
  //     await startHand(game);

  //     // update joiable gamelist to clients
  //     let existingGames = await getExistingGames();
  //     io.emit("activeGameUpdated", existingGames);

  //   } catch (e) {
  //     logError("startGame", e);
  //   }
  // });

  socket.on("call", async (gameId) => {
    await call(gameId, socket.id, io);
  });

  socket.on("raise", async (gameId, amount) => {
    await raise(gameId, socket.id, amount, io);
  });

  socket.on("check", async (gameId) => {
    await check(gameId, socket.id, io);
  });

  socket.on("fold", async (gameId) => {
    await fold(gameId, io, socket.id);
  });

  socket.on("leave", async (gameId) => {
    await leave(gameId, io, socket.id);
  });

  socket.on("allIn", async (gameId) => {
    await allIn(gameId, socket.id, io);
  });

  socket.on("listTables", async (callback) => {
    const tables = await knex<TemplateTable>("tables")
      .select("tables.*")
      .select({
        payToken: "tokens.id",
        payTokenName: "tokens.name",
        payTokenAddress: "tokens.address",
        payTokenDecimal: "tokens.decimal",
      })
      .where({ status: true })
      .leftJoin("tokens", "tables.payToken", "tokens.id");
    console.log(tables);

    callback(tables);
  });

  socket.on("disconnect", async (reason: string) => {
    console.log(`socket ${socket.id} disconnected, reason: ${reason}`);
    try {
      let playersFromSocket: Player[] = await knex<Player>("players")
        .select()
        .where({
          socketId: socket.id,
        })
        .leftJoin("users", "users.address", "players.address");
      if (playersFromSocket.length > 0) {
        let gamesFromSocket = await knex<Game>("games")
          .select()
          .where({
            id: playersFromSocket[playersFromSocket.length - 1].gameId,
          });
        if (gamesFromSocket.length > 0) {
          let player = playersFromSocket[playersFromSocket.length - 1];
          console.log(
            `playerId ${player.id} disconnected from gameId ${
              gamesFromSocket[gamesFromSocket.length - 1].id
            }`
          );
          let game = gamesFromSocket[gamesFromSocket.length - 1];
          if (
            game.startedAt &&
            !game.ended &&
            player.active &&
            player.lastAction != Action.LEAVE
          ) {
            console.log("game is performing...");

            // ====================
            await recordAction({
              gameId: game.id,
              socketId: player.socketId,
              playerId: player?.id,
              action: Action.AFK,
              bet: game.bet,
            });
            // player.lastAction = Action.LEAVE;
            // player.active = false;

            player.lastAction = Action.AFK;
            player.active = true;
            player.bet = 0;
            player.folded = true;

            await updatePlayer(player.id, {
              bet: player.bet,
              lastAction: player.lastAction,
              active: player.active,
              folded: player.folded,
            });
            console.log(`updated playerId ${player.id} to deactive.`);
            log(game.id, `${player.id} LEAVE`, io);
            // ====================

            if (game.currentPlayerId == player.id) {
              await changeTurn(game.id, io);
            } else {
              const players = await getActiveUnfoldedPlayers(game.id);
              await notifySeatsUpdated(players, game, io);
              if (players.length == 1) {
                await showdown(game, players, io);
              }
            }
          } else if (
            !game.startedAt &&
            player.active &&
            player.lastAction != Action.LEAVE
          ) {
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
            });
            console.log(`updated playerId ${player.id} to deactive.`);
            log(game.id, `${player.id} LEAVE`, io);
            // ====================

            // await knex.raw(`delete from players where "gameId"='${game.id}' and id='${player.id}'`)
            const players = await getActiveUnfoldedPlayers(game.id);

            console.log(`active players : ${players.length}`);

            await notifySeatsUpdated(players, game, io);
            // return entry fee back to user
            let payToken = await getTokenById(game.payToken);
            if (payToken?.address == SOL_ADDRESS) {
              userLeaveTableOnChain(
                game.initialStack,
                game.buyIn,
                game.minBet,
                game.numSeats,
                new PublicKey(player.address)
              );
            } else if (payToken?.address) {
              userLeaveTableWithTokenOnChain(
                game.initialStack,
                game.buyIn,
                game.minBet,
                game.numSeats,
                new PublicKey(player.address),
                new PublicKey(payToken.address)
              );
            }

            let currentGamePlayers = await knex<Player>("players")
              .select()
              .where({
                gameId: game.id,
              });
            let currentGameActivePlayers = await getActiveUnfoldedPlayers(
              game.id
            );

            setTimeout(async () => {
              let nextGame = await getGame(game.id);
              let nextGamePlayers = await knex<Player>("players")
                .select()
                .where({
                  gameId: game.id,
                });
              let nextGameActivePlayers = await getActiveUnfoldedPlayers(
                game.id
              );

              if (
                currentGamePlayers.length == nextGamePlayers.length &&
                currentGameActivePlayers.length ==
                  nextGameActivePlayers.length &&
                nextGame &&
                !nextGame.startedAt
              ) {
                await startGame(game, io);
                let existingGames = await getExistingGames();
                io.emit("activeGameUpdated", existingGames);
              }
            }, AUTO_START_TIME);

            let existingGames = await getExistingGames();
            io.emit("activeGameUpdated", existingGames);
          }
        }
      }
    } catch (e) {
      console.log(e);
    }
  });

  socket.on("getAfkGames", async (wallet: string, callback) => {
    let games = await getValidAfkGames(wallet);
    callback(games);
  });

  socket.on("rejoinGameFromAfk", async (wallet, gameId, callback) => {
    let game = await getGameById(gameId);

    if (!game) {
      callback(null);
      return;
    }
    let result = await canRejoinGameFromAfk(wallet, gameId);

    if (result) {
      const room = getRoomName(gameId);
      socket.join(room);
    } else {
      callback(null);
      return;
    }
    let returnResult = await rejoinGameFromAfk(wallet, gameId, socket.id);

    if (returnResult) {
      const players = await getActiveUnfoldedPlayers(game.id);
      await notifySeatsUpdated(players, game, io);
      callback(returnResult);
    } else {
      callback(null);
    }
  });
});
