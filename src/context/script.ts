import * as anchor from '@project-serum/anchor';

import {
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    Transaction,
    ParsedAccountData,
    Connection,
} from '@solana/web3.js';
import { DEPLOY_WALLET_ADDRESS, ESCROW_VAULT_SEED, GamePoolOnChain, GAME_POOL_SEED, GLOBAL_AUTHORITY_SEED, PROGRAM_ID, TOURNAMENT_POOL_SEED, TREASURY_WALLET } from './types';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";


export const getTableData = async (
    program: anchor.Program,
) => {
    const [_globalAuthority, _global_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        PROGRAM_ID,
    );

    const [gamePool, _game_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GAME_POOL_SEED)],
        PROGRAM_ID,
    );

    try {
        let tableData = await program.account.gamePool.fetch(gamePool) as unknown as GamePoolOnChain;
        let tableCount = tableData.tableCount.toNumber();
        let buyIn: number[] = [];
        let blinds: number[] = [];
        let stack: number[] = [];
        let payTokens: string[] = [];

        for (let i = 0; i < 10; i++) {
            buyIn.push(tableData.buyIn[i].toNumber())
            blinds.push(tableData.blinds[i].toNumber())
            stack.push(tableData.stack[i].toNumber())
            payTokens.push(tableData.payToken[i].toBase58())

        }
        let result = {
            buyIn,
            blinds,
            stack,
            maxSeats: tableData.maxSeats,
            tableCount
        }


        console.log(result)
        return result;
    } catch (e) {
        console.log(e)
        return null;
    }

}

export const createInitializeTx = async (
    admin: PublicKey,
    program: anchor.Program,
) => {
    const [globalAuthority, global_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        PROGRAM_ID,
    );
    const [escrowVault, escrow_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(ESCROW_VAULT_SEED)],
        PROGRAM_ID,
    );

    let tx = new Transaction();
    console.log('==>initializing program', globalAuthority.toBase58(), admin.toBase58());

    tx.add(program.instruction.initialize(
        global_bump, escrow_bump, {
        accounts: {
            admin: admin,
            globalAuthority,
            escrowVault,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
        },
        instructions: [],
        signers: [],
    }));

    return tx;
}


export const createUpdateAdminTx = async (
    admin: PublicKey,
    program: anchor.Program,
    newAdmin: PublicKey
) => {
    const [globalAuthority, global_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        PROGRAM_ID,
    );

    let tx = new Transaction();
    console.log('==>initializing program', globalAuthority.toBase58(), admin.toBase58());

    tx.add(program.instruction.updateAdmin(
        global_bump, newAdmin, {
        accounts: {
            admin: admin,
            globalAuthority,
        },
        instructions: [],
        signers: [],
    }));

    return tx;
}

export const createUpdateTreasuryTx = async (
    admin: PublicKey,
    program: anchor.Program,
    newTreasury: PublicKey
) => {
    const [globalAuthority, global_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        PROGRAM_ID,
    );
    let tx = new Transaction();
    console.log('==>initializing program', globalAuthority.toBase58(), admin.toBase58());

    tx.add(program.instruction.updateTreasury(
        global_bump, newTreasury, {
        accounts: {
            admin: admin,
            globalAuthority,
        },
        instructions: [],
        signers: [],
    }));
    return tx;
}

export const createUpdateBackendWalletTx = async (
    admin: PublicKey,
    program: anchor.Program,
    backend_wallet: PublicKey
) => {
    const [globalAuthority, global_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        PROGRAM_ID,
    );
    let tx = new Transaction();
    console.log('==>initializing program', globalAuthority.toBase58(), admin.toBase58());

    tx.add(program.instruction.updateBackend(
        global_bump, backend_wallet, {
        accounts: {
            admin: admin,
            globalAuthority,
        },
        instructions: [],
        signers: [],
    }));
    return tx;
}

export const createAddTournamentTx = async (
    admin: PublicKey,
    program: anchor.Program,
    stack: number,
    buy_in: number,
    blinds: number,
    max_seats: number,
    tokenMint: PublicKey,
) => {
    const [globalAuthority, global_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        PROGRAM_ID,
    );

    const [tournamentPool, tournament_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(TOURNAMENT_POOL_SEED)],
        PROGRAM_ID,
    );

    let tx = new Transaction();
    console.log(' adding a new tournament...');
    console.log('  global authority : ', globalAuthority.toBase58());
    console.log('  admin address : ', admin.toBase58())
    console.log('  tournament pool address : ', tournamentPool.toBase58());

    tx.add(program.instruction.addTournament(
        global_bump, tournament_bump, new anchor.BN(stack), new anchor.BN(buy_in), new anchor.BN(blinds), new anchor.BN(max_seats), tokenMint, {
        accounts: {
            admin: admin,
            globalAuthority,
            tournamentPool,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
        },
        instructions: [],
        signers: [],
    }));
    return tx;
}

export const createAddTableTx = async (
    admin: PublicKey,
    program: anchor.Program,
    stack: number,
    buy_in: number,
    blinds: number,
    max_seats: number
) => {
    const [globalAuthority, global_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        PROGRAM_ID,
    );

    const [gamePool, game_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GAME_POOL_SEED)],
        PROGRAM_ID,
    );

    let tx = new Transaction();
    console.log('==>initializing program', globalAuthority.toBase58(), admin.toBase58());

    tx.add(program.instruction.addTable(
        global_bump, game_bump, new anchor.BN(stack), new anchor.BN(buy_in), new anchor.BN(blinds), new anchor.BN(max_seats), {
        accounts: {
            admin: admin,
            globalAuthority,
            gamePool,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
        },
        instructions: [],
        signers: [],
    }));
    return tx;
}

export const createRemoveTournamentTx = async (
    admin: PublicKey,
    program: anchor.Program,
    stack: number,
    buy_in: number,
    blinds: number,
    max_seats: number,
    tokenMint: PublicKey,
) => {
    const [globalAuthority, global_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        PROGRAM_ID,
    );

    const [tournamentPool, tournament_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(TOURNAMENT_POOL_SEED)],
        PROGRAM_ID,
    );

    let tx = new Transaction();
    console.log(' removing existing tournament...');
    console.log('  global authority : ', globalAuthority.toBase58());
    console.log('  admin address : ', admin.toBase58())
    console.log('  tournament pool address : ', tournamentPool.toBase58());

    tx.add(program.instruction.removeTournament(
        global_bump, tournament_bump, new anchor.BN(stack), new anchor.BN(buy_in), new anchor.BN(blinds), new anchor.BN(max_seats), tokenMint, {
        accounts: {
            admin: admin,
            globalAuthority,
            tournamentPool
        },
        instructions: [],
        signers: [],
    }));
    return tx;
}

export const createRemoveTableTx = async (
    admin: PublicKey,
    program: anchor.Program,
    stack: number,
    buy_in: number,
    blinds: number,
    max_seats: number
) => {
    const [globalAuthority, global_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        PROGRAM_ID,
    );

    const [gamePool, game_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GAME_POOL_SEED)],
        PROGRAM_ID,
    );

    let tx = new Transaction();
    console.log('==>initializing program', globalAuthority.toBase58(), admin.toBase58());

    tx.add(program.instruction.removeTable(
        global_bump, game_bump, new anchor.BN(stack), new anchor.BN(buy_in), new anchor.BN(blinds), new anchor.BN(max_seats), {
        accounts: {
            admin: admin,
            globalAuthority,
            gamePool
        },
        instructions: [],
        signers: [],
    }));
    return tx;
}

export const createEnterTournamentTx = async (
    player: PublicKey,
    program: anchor.Program,
    stack: number,
    buy_in: number,
    blinds: number,
    max_seats: number
) => {
    const [escrowVault, escrow_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(ESCROW_VAULT_SEED)],
        PROGRAM_ID,
    );

    let tournamentPool = await anchor.web3.PublicKey.createWithSeed(
        new PublicKey(DEPLOY_WALLET_ADDRESS),
        TOURNAMENT_POOL_SEED,
        PROGRAM_ID,
    );

    let tx = new Transaction();

    tx.add(program.instruction.enterTournament(
        escrow_bump, new anchor.BN(stack), new anchor.BN(buy_in), new anchor.BN(blinds), new anchor.BN(max_seats), {
        accounts: {
            player: player,
            escrowVault,
            tournamentPool,
            systemProgram: SystemProgram.programId,
        },
        instructions: [],
        signers: [],
    }));
    return tx;
}

export const createEnterTableTx = async (
    player: PublicKey,
    program: anchor.Program,
    stack: number,
    buy_in: number,
    blinds: number,
    max_seats: number
) => {
    const [escrowVault, escrow_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(ESCROW_VAULT_SEED)],
        PROGRAM_ID,
    );

    const [gamePool, game_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GAME_POOL_SEED)],
        PROGRAM_ID,
    );

    let tx = new Transaction();

    tx.add(program.instruction.enterTable(
        escrow_bump, game_bump, new anchor.BN(stack), new anchor.BN(buy_in), new anchor.BN(blinds), new anchor.BN(max_seats), {
        accounts: {
            player: player,
            escrowVault,
            gamePool,
            systemProgram: SystemProgram.programId,

        },
        instructions: [],
        signers: [],
    }));
    return tx;
}


export const createUserLeaveTournamentTx = async (
    admin: PublicKey,
    program: anchor.Program,
    stack: number,
    buy_in: number,
    blinds: number,
    max_seats: number,
    user: PublicKey
) => {

    const [globalAuthority, global_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        PROGRAM_ID,
    );

    const [escrowVault, escrow_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(ESCROW_VAULT_SEED)],
        PROGRAM_ID,
    );

    let tournamentPool = await anchor.web3.PublicKey.createWithSeed(
        new PublicKey(DEPLOY_WALLET_ADDRESS),
        TOURNAMENT_POOL_SEED,
        PROGRAM_ID,
    );

    let tx = new Transaction();

    tx.add(program.instruction.userLeaveTournament(
        global_bump, escrow_bump, new anchor.BN(stack), new anchor.BN(buy_in), new anchor.BN(blinds), new anchor.BN(max_seats), {
        accounts: {
            owner: admin,
            globalAuthority,
            escrowVault,
            tournamentPool,
            user,
            systemProgram: SystemProgram.programId,

        },
        instructions: [],
        signers: [],
    }));
    return tx;
}

export const createUserLeaveTournamentWithTokenTx = async (
    admin: PublicKey,
    program: anchor.Program,
    stack: number,
    buy_in: number,
    blinds: number,
    max_seats: number,
    user: PublicKey,
    tokenMint: PublicKey,
    solConnection: Connection
) => {

    const [globalAuthority, global_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        PROGRAM_ID,
    );

    const [escrowVault, escrow_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(ESCROW_VAULT_SEED)],
        PROGRAM_ID,
    );

    let tournamentPool = await anchor.web3.PublicKey.createWithSeed(
        new PublicKey(DEPLOY_WALLET_ADDRESS),
        TOURNAMENT_POOL_SEED,
        PROGRAM_ID,
    );

    let vaultTokenAccount = await getAssociatedTokenAccount(escrowVault, tokenMint);
    let { instructions, destinationAccounts } = await getATokenAccountsNeedCreate(
        solConnection,
        user,
        user,
        [tokenMint]
    );

    let tx = new Transaction();
    if (instructions.length > 0) {
        tx.add(...instructions);
    }

    tx.add(program.instruction.userLeaveTournamentWithToken(
        global_bump, escrow_bump, new anchor.BN(stack), new anchor.BN(buy_in), new anchor.BN(blinds), new anchor.BN(max_seats), {
        accounts: {
            owner: admin,
            globalAuthority,
            escrowVault,
            tournamentPool,
            tokenMint,
            user,
            playerTokenAccount: destinationAccounts[0],
            vaultTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        },
        instructions: [],
        signers: [],
    }));
    return tx;
}

export const createUserLeaveTableTx = async (
    admin: PublicKey,
    program: anchor.Program,
    stack: number,
    buy_in: number,
    blinds: number,
    max_seats: number,
    user: PublicKey
) => {

    const [globalAuthority, global_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        PROGRAM_ID,
    );

    const [escrowVault, escrow_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(ESCROW_VAULT_SEED)],
        PROGRAM_ID,
    );

    const [gamePool, game_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GAME_POOL_SEED)],
        PROGRAM_ID,
    );

    let tx = new Transaction();

    tx.add(program.instruction.userLeaveTable(
        global_bump, escrow_bump, game_bump, new anchor.BN(stack), new anchor.BN(buy_in), new anchor.BN(blinds), new anchor.BN(max_seats), {
        accounts: {
            owner: admin,
            globalAuthority,
            escrowVault,
            gamePool,
            user,
            systemProgram: SystemProgram.programId,

        },
        instructions: [],
        signers: [],
    }));
    return tx;
}

export const createSendRewardTx = async (
    owner: PublicKey,
    program: anchor.Program,
    winner: PublicKey,
    totalWinnedVault: number,
    leaveVault: number
) => {

    const [globalAuthority, global_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        PROGRAM_ID,
    );

    const [escrowVault, escrow_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(ESCROW_VAULT_SEED)],
        PROGRAM_ID,
    );

    let tx = new Transaction();

    tx.add(program.instruction.sendReward(
        global_bump, escrow_bump, new anchor.BN(totalWinnedVault), new anchor.BN(leaveVault), {
        accounts: {
            owner,
            globalAuthority,
            escrowVault,
            treasury: TREASURY_WALLET,
            winner,
            systemProgram: SystemProgram.programId,
        },
        instructions: [],
        signers: [],
    }));
    return tx;
}


export const createUserLeaveTableWithTokenTx = async (
    admin: PublicKey,
    program: anchor.Program,
    stack: number,
    buy_in: number,
    blinds: number,
    max_seats: number,
    user: PublicKey,
    tokenMint: PublicKey,
    solConnection: Connection
) => {

    const [globalAuthority, global_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        PROGRAM_ID,
    );

    const [escrowVault, escrow_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(ESCROW_VAULT_SEED)],
        PROGRAM_ID,
    );

    const [gamePool, game_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GAME_POOL_SEED)],
        PROGRAM_ID,
    );

    let vaultTokenAccount = await getAssociatedTokenAccount(escrowVault, tokenMint);
    let { instructions, destinationAccounts } = await getATokenAccountsNeedCreate(
        solConnection,
        user,
        user,
        [tokenMint]
    );

    let tx = new Transaction();
    if (instructions.length > 0) {
        tx.add(...instructions);
    }
    tx.add(program.instruction.userLeaveTableWithToken(
        global_bump, escrow_bump, game_bump, new anchor.BN(stack), new anchor.BN(buy_in), new anchor.BN(blinds), new anchor.BN(max_seats), {
        accounts: {
            owner: admin,
            globalAuthority,
            escrowVault,
            gamePool,
            tokenMint,
            user,
            playerTokenAccount: destinationAccounts[0],
            vaultTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,

        },
        instructions: [],
        signers: [],
    }));
    return tx;
}

export const createSendRewardWithTokenTx = async (
    owner: PublicKey,
    program: anchor.Program,
    winner: PublicKey,
    totalWinnedVault: number,
    leaveVault: number,
    tokenMint: PublicKey,
    solConnection: Connection
) => {

    const [globalAuthority, global_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        PROGRAM_ID,
    );

    const [escrowVault, escrow_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(ESCROW_VAULT_SEED)],
        PROGRAM_ID,
    );

    let vaultTokenAccount = await getAssociatedTokenAccount(escrowVault, tokenMint);
    console.log("vault token account ", vaultTokenAccount.toBase58())
    let tx = new Transaction();

    let { instructions, destinationAccounts } = await getATokenAccountsNeedCreate(
        solConnection,
        owner,
        winner,
        [tokenMint]
    );
    let winnerTokenAccount = destinationAccounts[0];
    if (instructions.length > 0) {
        tx.add(...instructions)
    }

    let result = await getATokenAccountsNeedCreate(
        solConnection,
        owner,
        TREASURY_WALLET,
        [tokenMint],
        false
    );
    let treasuryTokenAccount = result.destinationAccounts[0]
    if (result.instructions.length > 0) {
        tx.add(...result.instructions)
    }

    // if (result.instructions.length > 0) {
    //     tx.add(...result.instructions);
    // }


    tx.add(program.instruction.sendRewardWithToken(
        global_bump, escrow_bump, new anchor.BN(totalWinnedVault), new anchor.BN(leaveVault), {
        accounts: {
            owner,
            globalAuthority,
            escrowVault,
            treasury: TREASURY_WALLET,
            winner,
            tokenMint,
            winnerTokenAccount,
            vaultTokenAccount,
            treasuryTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        },
        instructions: [],
        signers: [],
    }));
    return tx;
}



export const getDecimals = async (
    owner: PublicKey,
    tokenMint: PublicKey,
    solConnection: anchor.web3.Connection,
): Promise<number | null> => {
    try {
        let ownerTokenAccount = await getAssociatedTokenAccount(owner, tokenMint);
        const tokenAccount = await solConnection.getParsedAccountInfo(ownerTokenAccount);
        let decimal = (tokenAccount.value?.data as ParsedAccountData).parsed.info.tokenAmount.decimals;
        let DECIMALS = Math.pow(10, decimal);
        return DECIMALS;
    } catch {
        return null;
    }
}
const getAssociatedTokenAccount = async (ownerPubkey: PublicKey, mintPk: PublicKey): Promise<PublicKey> => {
    let associatedTokenAccountPubkey = (await PublicKey.findProgramAddress(
        [
            ownerPubkey.toBuffer(),
            TOKEN_PROGRAM_ID.toBuffer(),
            mintPk.toBuffer(), // mint address
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
    ))[0];
    return associatedTokenAccountPubkey;
}

export const getATokenAccountsNeedCreate = async (
    connection: anchor.web3.Connection,
    walletAddress: anchor.web3.PublicKey,
    owner: anchor.web3.PublicKey,
    nfts: anchor.web3.PublicKey[],
    walletATAGenerate: boolean = true
) => {
    let instructions = [], destinationAccounts = [];
    for (const mint of nfts) {
        const destinationPubkey = await getAssociatedTokenAccount(owner, mint);
        let response = await connection.getAccountInfo(destinationPubkey);
        if (!response) {

            const createATAIx = createAssociatedTokenAccountInstruction(
                destinationPubkey,
                walletAddress,
                owner,
                mint,
            );
            instructions.push(createATAIx);
        }
        destinationAccounts.push(destinationPubkey);
        if (walletAddress != owner && walletATAGenerate) {

            const userAccount = await getAssociatedTokenAccount(walletAddress, mint);
            response = await connection.getAccountInfo(userAccount);
            if (!response) {

                const createATAIx = createAssociatedTokenAccountInstruction(
                    userAccount,
                    walletAddress,
                    walletAddress,
                    mint,
                );
                instructions.push(createATAIx);
            }
        }
    }
    return {
        instructions,
        destinationAccounts,
    };
}

export const createAssociatedTokenAccountInstruction = (
    associatedTokenAddress: anchor.web3.PublicKey,
    payer: anchor.web3.PublicKey,
    walletAddress: anchor.web3.PublicKey,
    splTokenMintAddress: anchor.web3.PublicKey
) => {
    const keys = [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
        { pubkey: walletAddress, isSigner: false, isWritable: false },
        { pubkey: splTokenMintAddress, isSigner: false, isWritable: false },
        {
            pubkey: anchor.web3.SystemProgram.programId,
            isSigner: false,
            isWritable: false,
        },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        {
            pubkey: anchor.web3.SYSVAR_RENT_PUBKEY,
            isSigner: false,
            isWritable: false,
        },
    ];
    return new anchor.web3.TransactionInstruction({
        keys,
        programId: ASSOCIATED_TOKEN_PROGRAM_ID,
        data: Buffer.from([]),
    });
}



export const createSendTournamentRewardTx = async (
    owner: PublicKey,
    program: anchor.Program,
    rewardAmount: number,
    stack: number,
    buyIn: number,
    blinds: number,
    maxSeats: number,
    rewardPlan: number[],
    winners: string[],
) => {

    const [globalAuthority, global_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        PROGRAM_ID,
    );

    const [escrowVault, escrow_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(ESCROW_VAULT_SEED)],
        PROGRAM_ID,
    );
    let tournamentPool = await anchor.web3.PublicKey.createWithSeed(
        new PublicKey(DEPLOY_WALLET_ADDRESS),
        TOURNAMENT_POOL_SEED,
        PROGRAM_ID,
    );

    let revenue: anchor.BN[] = [];
    for (let i = 0; i < rewardPlan.length; i++) {
        revenue[i] = new anchor.BN(rewardPlan[i])
    }

    let remainingAccounts = [];
    for (let winner of winners) {
        remainingAccounts.push({
            pubkey: new PublicKey(winner),
            isSigner: false,
            isWritable: true
        })
    }

    let tx = new Transaction();

    tx.add(program.instruction.sendTournamentReward(
        global_bump, escrow_bump, new anchor.BN(rewardAmount), new anchor.BN(stack), new anchor.BN(buyIn), new anchor.BN(blinds), new anchor.BN(maxSeats), revenue, {
        accounts: {
            owner,
            globalAuthority,
            escrowVault,
            tournamentPool,
            treasury: TREASURY_WALLET,
            systemProgram: SystemProgram.programId,
        },
        remainingAccounts,
        instructions: [],
        signers: [],
    }));
    return tx;
}

export const createSendTournamentRewardWithTokenTx = async (
    owner: PublicKey,
    program: anchor.Program,
    tokenMint: PublicKey,
    rewardAmount: number,
    stack: number,
    buyIn: number,
    blinds: number,
    maxSeats: number,
    rewardPlan: number[],
    winners: string[],
    solConnection: Connection
) => {
    const [globalAuthority, global_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(GLOBAL_AUTHORITY_SEED)],
        PROGRAM_ID,
    );

    const [escrowVault, escrow_bump] = await PublicKey.findProgramAddress(
        [Buffer.from(ESCROW_VAULT_SEED)],
        PROGRAM_ID,
    );
    let tournamentPool = await anchor.web3.PublicKey.createWithSeed(
        new PublicKey(DEPLOY_WALLET_ADDRESS),
        TOURNAMENT_POOL_SEED,
        PROGRAM_ID,
    );

    let vaultTokenAccount = await getAssociatedTokenAccount(escrowVault, tokenMint);

    let revenue: anchor.BN[] = [];
    for (let i = 0; i < rewardPlan.length; i++) {
        revenue[i] = new anchor.BN(rewardPlan[i])
    }

    let tx = new Transaction();

    let remainingAccounts = [];
    for (let winner of winners) {
        let result = await getATokenAccountsNeedCreate(
            solConnection,
            owner,
            new PublicKey(winner),
            [tokenMint],
            false
        );

        if (result.instructions.length > 0) {
            tx.add(...result.instructions)
        }

        remainingAccounts.push({
            pubkey: result.destinationAccounts[0],
            isSigner: false,
            isWritable: true
        })
    }

    let result = await getATokenAccountsNeedCreate(
        solConnection,
        owner,
        TREASURY_WALLET,
        [tokenMint],
        false
    );
    let treasuryTokenAccount = result.destinationAccounts[0]
    if (result.instructions.length > 0) {
        tx.add(...result.instructions)
    }

    tx.add(program.instruction.sendTournamentRewardWithToken(
        global_bump, escrow_bump, new anchor.BN(rewardAmount), new anchor.BN(stack), new anchor.BN(buyIn), new anchor.BN(blinds), new anchor.BN(maxSeats), revenue, {
        accounts: {
            owner,
            globalAuthority,
            escrowVault,
            tournamentPool,
            treasury: TREASURY_WALLET,
            tokenMint,
            vaultTokenAccount,
            treasuryTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        },
        remainingAccounts,
        instructions: [],
        signers: [],
    }));
    return tx;

}

