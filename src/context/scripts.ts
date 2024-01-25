import { web3 } from '@project-serum/anchor';
import * as anchor from '@project-serum/anchor';

import fs from 'fs';
import path from 'path';
import NodeWallet from '@project-serum/anchor/dist/cjs/nodewallet';
import { IDL as BonesPokerIDL } from "./bones_poker_contract";
import {
    PublicKey,

    Keypair
} from '@solana/web3.js';
import { PROGRAM_ID } from './types';
import { createAddTableTx, createAddTournamentTx, createEnterTableTx, createEnterTournamentTx, createInitializeTx, createRemoveTableTx, createRemoveTournamentTx, createSendRewardTx, createSendRewardWithTokenTx, createSendTournamentRewardTx, createSendTournamentRewardWithTokenTx, createUpdateAdminTx, createUpdateBackendWalletTx, createUpdateTreasuryTx, createUserLeaveTableTx, createUserLeaveTableWithTokenTx, createUserLeaveTournamentTx, createUserLeaveTournamentWithTokenTx, getTableData } from './script';


const programId = new anchor.web3.PublicKey(PROGRAM_ID);

const BE_WALLET_ADDRESS = process.env.BE_WALLET || './src/context/BP-BE-devnet.json';
const CLUSTER = process.env.SOLANA_NETWORK as web3.Cluster || 'devnet';
let solConnection = new web3.Connection(web3.clusterApiUrl(CLUSTER));

// const RPC = "https://neat-dry-patron.solana-mainnet.quiknode.pro/49a414d786b7497bca9f7f09df812df6d458c929";
// let solConnection = new web3.Connection(RPC);
const walletKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.resolve(BE_WALLET_ADDRESS), 'utf-8'))), { skipValidation: true });
const wallet = new NodeWallet(walletKeypair);
anchor.setProvider(new anchor.AnchorProvider(solConnection, wallet, { skipPreflight: true, commitment: 'confirmed' }));
const payer = wallet;
const program = new anchor.Program(BonesPokerIDL as anchor.Idl, programId);

// export const setClusterConfig = async (cluster: web3.Cluster) => {

//     console.log("payer path: ", BE_WALLET_ADDRESS);
//     console.log("payer: ", payer.publicKey.toBase58());

//     // Generate the program client from IDL.
//     console.log('ProgramId: ', program.programId.toBase58());

//     const [globalAuthority, bump] = await PublicKey.findProgramAddress(
//         [Buffer.from(GLOBAL_AUTHORITY_SEED)],
//         program.programId
//     );
//     console.log('GlobalAuthority: ', globalAuthority.toBase58());
// }


// const main = async () => {
// setClusterConfig('devnet');
// await initProject();
// await updateAdmin(new PublicKey("6tszx7eZ2hBFQBKqx8emdWmSZc9SLQKubRKfvfgdgdnK"));
// await updateTreasury(new PublicKey("G42V1DfQKKHrxxfdjDrRphPStZx5Jqu2JwShfN3WoKmK"));
// await updateBackendWallet(new PublicKey("3wXAk9JUYqbVcXyYtNAgQzHz7m47CzQ6kRPennxpJFtU"));
// await addTable(100, 100000000, 10, 8);
// await RemoveTable(100, 100000000, 10, 10);

// await enterTable(100, 100000000, 10, 8);
// await userLeaveTable(100, 100000000, 10, 8, new PublicKey("3wXAk9JUYqbVcXyYtNAgQzHz7m47CzQ6kRPennxpJFtU"))
// await sendReward(new PublicKey("G42V1DfQKKHrxxfdjDrRphPStZx5Jqu2JwShfN3WoKmK"), new PublicKey("DjMMsvj4ZUBpAXCaR2Z7XuqzWFMegpb86iEKBfj1HrH8"), 100000000);

// }
export const getTableDataOnChain = async () => {
    try {



        let tableData = await getTableData(program);
        return tableData;
    } catch (e) {
        console.log(e)
        return null;
    }
}


export const initProject = async (
) => {
    const tx = await createInitializeTx(payer.publicKey, program);
    const { blockhash } = await solConnection.getRecentBlockhash('confirmed');
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = blockhash;
    payer.signTransaction(tx);
    let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
    await solConnection.confirmTransaction(txId, "confirmed");
    console.log("txHash =", txId);
}

export const updateAdmin = async (
    newAdmin: PublicKey
) => {
    const tx = await createUpdateAdminTx(payer.publicKey, program, newAdmin);
    const { blockhash } = await solConnection.getRecentBlockhash('confirmed');
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = blockhash;
    payer.signTransaction(tx);
    let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
    await solConnection.confirmTransaction(txId, "confirmed");
    console.log("txHash =", txId);
}

export const updateTreasury = async (
    treasury: PublicKey
) => {
    const tx = await createUpdateTreasuryTx(payer.publicKey, program, treasury);
    const { blockhash } = await solConnection.getRecentBlockhash('confirmed');
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = blockhash;
    payer.signTransaction(tx);
    let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
    await solConnection.confirmTransaction(txId, "confirmed");
    console.log("txHash =", txId);
}

export const updateBackendWallet = async (
    newBackend: PublicKey
) => {
    const tx = await createUpdateBackendWalletTx(payer.publicKey, program, newBackend);
    const { blockhash } = await solConnection.getRecentBlockhash('confirmed');
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = blockhash;
    payer.signTransaction(tx);
    let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
    await solConnection.confirmTransaction(txId, "confirmed");
    console.log("txHash =", txId);
}

export const addTable = async (
    stack: number,
    buy_in: number,
    blinds: number,
    max_seats: number
) => {
    const tx = await createAddTableTx(payer.publicKey, program, stack, buy_in, blinds, max_seats);
    const { blockhash } = await solConnection.getRecentBlockhash('confirmed');
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = blockhash;
    payer.signTransaction(tx);
    let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
    await solConnection.confirmTransaction(txId, "confirmed");
    console.log("txHash =", txId);
}


export const addTournament = async (
    stack: number,
    buy_in: number,
    blinds: number,
    max_seats: number,
    tokenMint: PublicKey
) => {
    const tx = await createAddTournamentTx(payer.publicKey, program, stack, buy_in, blinds, max_seats, tokenMint);
    const { blockhash } = await solConnection.getRecentBlockhash('confirmed');
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = blockhash;
    payer.signTransaction(tx);
    let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
    await solConnection.confirmTransaction(txId, "confirmed");
    console.log("txHash =", txId);
}
export const removeTournamentOnChain = async (
    stack: number,
    buy_in: number,
    blinds: number,
    max_seats: number,
    tokenMint: PublicKey,
) => {
    try {
        const tx = await createRemoveTournamentTx(payer.publicKey, program, stack, buy_in, blinds, max_seats, tokenMint);
        const { blockhash } = await solConnection.getRecentBlockhash('confirmed');
        tx.feePayer = payer.publicKey;
        tx.recentBlockhash = blockhash;
        payer.signTransaction(tx);
        let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
        await solConnection.confirmTransaction(txId, "confirmed");
        console.log("txHash =", txId);
    } catch (e) {
        console.log('err on removeTournamentOnChain >> ', e);
    }
}

export const removeTable = async (
    stack: number,
    buy_in: number,
    blinds: number,
    max_seats: number
) => {
    const tx = await createRemoveTableTx(payer.publicKey, program, stack, buy_in, blinds, max_seats);
    const { blockhash } = await solConnection.getRecentBlockhash('confirmed');
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = blockhash;
    payer.signTransaction(tx);
    let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
    await solConnection.confirmTransaction(txId, "confirmed");
    console.log("txHash =", txId);
}

export const enterTournament = async (
    stack: number,
    buy_in: number,
    blinds: number,
    max_seats: number
) => {
    const tx = await createEnterTournamentTx(payer.publicKey, program, stack, buy_in, blinds, max_seats);
    const { blockhash } = await solConnection.getRecentBlockhash('confirmed');
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = blockhash;
    payer.signTransaction(tx);
    let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
    await solConnection.confirmTransaction(txId, "confirmed");
    console.log("txHash =", txId);
}

export const enterTable = async (
    stack: number,
    buy_in: number,
    blinds: number,
    max_seats: number
) => {
    const tx = await createEnterTableTx(payer.publicKey, program, stack, buy_in, blinds, max_seats);
    const { blockhash } = await solConnection.getRecentBlockhash('confirmed');
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = blockhash;
    payer.signTransaction(tx);
    let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
    await solConnection.confirmTransaction(txId, "confirmed");
    console.log("txHash =", txId);
}

export const userLeaveTournamentWithToken = async (
    stack: number,
    buy_in: number,
    blinds: number,
    max_seats: number,
    user: PublicKey,
    tokenMint: PublicKey
) => {
    try {
        const tx = await createUserLeaveTournamentWithTokenTx(payer.publicKey, program, stack, buy_in, blinds, max_seats, user, tokenMint, solConnection);
        const { blockhash } = await solConnection.getRecentBlockhash('confirmed');
        tx.feePayer = payer.publicKey;
        tx.recentBlockhash = blockhash;
        payer.signTransaction(tx);
        let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
        await solConnection.confirmTransaction(txId, "confirmed");
        console.log("txHash =", txId);
    } catch (e) {
        console.log("err on userLeaveTournamentWithToken ", e);
        await userLeaveTournamentWithToken(
            stack, buy_in, blinds, max_seats, user, tokenMint
        )
    }
}

export const userLeaveTournament = async (
    stack: number,
    buy_in: number,
    blinds: number,
    max_seats: number,
    user: PublicKey
) => {
    try {
        const tx = await createUserLeaveTournamentTx(payer.publicKey, program, stack, buy_in, blinds, max_seats, user);
        const { blockhash } = await solConnection.getRecentBlockhash('confirmed');
        tx.feePayer = payer.publicKey;
        tx.recentBlockhash = blockhash;
        payer.signTransaction(tx);
        let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
        await solConnection.confirmTransaction(txId, "confirmed");
        console.log("txHash =", txId);
    } catch (e) {
        console.log("err on userLeaveTournament ", e)
        await userLeaveTournament(stack, buy_in, blinds, max_seats, user)
    }
}

export const userLeaveTableOnChain = async (
    stack: number,
    buy_in: number,
    blinds: number,
    max_seats: number,
    user: PublicKey
) => {
    try {
        const tx = await createUserLeaveTableTx(payer.publicKey, program, stack, buy_in, blinds, max_seats, user);
        const { blockhash } = await solConnection.getLatestBlockhash('confirmed');
        tx.feePayer = payer.publicKey;
        tx.recentBlockhash = blockhash;
        payer.signTransaction(tx);
        let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
        await solConnection.confirmTransaction(txId, "confirmed");
        console.log("userleave txHash =", txId);
    } catch (e) {
        console.log(e)
        await userLeaveTableOnChain(
            stack, buy_in, blinds, max_seats, user
        )
    }
}


export const userLeaveTableWithTokenOnChain = async (
    stack: number,
    buy_in: number,
    blinds: number,
    max_seats: number,
    user: PublicKey,
    tokenMint: PublicKey
) => {
    try {
        const tx = await createUserLeaveTableWithTokenTx(payer.publicKey, program, stack, buy_in, blinds, max_seats, user, tokenMint, solConnection);
        const { blockhash } = await solConnection.getLatestBlockhash('confirmed');
        tx.feePayer = payer.publicKey;
        tx.recentBlockhash = blockhash;
        payer.signTransaction(tx);
        let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
        await solConnection.confirmTransaction(txId, "confirmed");
        console.log("userleave txHash =", txId);
    } catch (e) {
        console.log(e)
        await userLeaveTableWithTokenOnChain(
            stack, buy_in, blinds, max_seats, user, tokenMint
        )
    }
}

export const sendReward = async (
    winner: PublicKey,
    totalWinnedVault: number,
    leaveVault: number
) => {
    try {
        console.log("payer >> ", payer.publicKey.toBase58())

        const tx = await createSendRewardTx(payer.publicKey, program, winner, totalWinnedVault, leaveVault);
        const { blockhash } = await solConnection.getLatestBlockhash('confirmed');
        tx.feePayer = payer.publicKey;
        tx.recentBlockhash = blockhash;
        payer.signTransaction(tx);
        let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
        await solConnection.confirmTransaction(txId, "confirmed");
        console.log("sendReward txHash =", txId);
    } catch (e) {
        console.log(e)
        await sendReward(winner, totalWinnedVault, leaveVault)
    }
}

export const sendRewardWithToken = async (
    winner: PublicKey,
    totalWinnedVault: number,
    leaveVault: number,
    tokenMint: PublicKey
) => {
    try {
        console.log("payer >> ", payer.publicKey.toBase58())

        const tx = await createSendRewardWithTokenTx(payer.publicKey, program, winner, totalWinnedVault, leaveVault, tokenMint, solConnection);
        const { blockhash } = await solConnection.getLatestBlockhash('confirmed');
        tx.feePayer = payer.publicKey;
        tx.recentBlockhash = blockhash;
        payer.signTransaction(tx);
        let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
        await solConnection.confirmTransaction(txId, "confirmed");
        console.log("sendReward txHash =", txId);
    } catch (e) {
        console.log(e)
        await sendRewardWithToken(winner, totalWinnedVault, leaveVault, tokenMint)
    }
}


export const sendTournamentReward = async (
    rewardAmount: number,
    stack: number,
    buy_in: number,
    blinds: number,
    max_seats: number,
    rewardPlan: number[],
    winners: string[]
) => {
    try {
        console.log("sending reward for tournament with sol...")
        const tx = await createSendTournamentRewardTx(payer.publicKey, program, rewardAmount, stack, buy_in, blinds, max_seats, rewardPlan, winners);
        const { blockhash } = await solConnection.getRecentBlockhash('confirmed');
        tx.feePayer = payer.publicKey;
        tx.recentBlockhash = blockhash;
        payer.signTransaction(tx);
        let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
        await solConnection.confirmTransaction(txId, "confirmed");
        console.log("txHash =", txId);
    } catch (e) {
        console.log("err on sendTournamentReward ", e);
        await sendTournamentReward(rewardAmount, stack, buy_in, blinds, max_seats, rewardPlan, winners)
    }
}

export const sendTournamentRewardWithToken = async (
    rewardAmount: number,
    stack: number,
    buy_in: number,
    blinds: number,
    max_seats: number,
    rewardPlan: number[],
    winners: string[],
    tokenMint: PublicKey
) => {
    try {
        console.log("sending reward for tournament with token...")
        const tx = await createSendTournamentRewardWithTokenTx(payer.publicKey, program, tokenMint, rewardAmount, stack, buy_in, blinds, max_seats, rewardPlan, winners, solConnection);
        const { blockhash } = await solConnection.getRecentBlockhash('confirmed');
        tx.feePayer = payer.publicKey;
        tx.recentBlockhash = blockhash;
        payer.signTransaction(tx);
        let txId = await solConnection.sendTransaction(tx, [(payer as NodeWallet).payer]);
        await solConnection.confirmTransaction(txId, "confirmed");
        console.log("txHash =", txId);
    } catch (e) {
        console.log("err on sendTournamentRewardWithToken ", e);
        await sendTournamentRewardWithToken(rewardAmount, stack, buy_in, blinds, max_seats, rewardPlan, winners, tokenMint);
    }
}
// main();