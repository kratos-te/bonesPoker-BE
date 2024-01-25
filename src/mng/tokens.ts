import { Token } from "../types/Token";
import { getKnex } from "../knex";
import { Table } from "../types/Table";
import { Tournament } from "src/types/Tournament";
const knex = getKnex();

export const getTokenList = async (): Promise<Token[]> => {
    try {
        let tokenList = await knex<Token>("tokens").select();
        return tokenList
    } catch (e) {
        console.log("err on getTokenList ", e);
        return []
    }
}

export const isTokenExist = async (args: Partial<Token>): Promise<boolean> => {
    try {
        let tokens = await knex<Token>("tokens").select().where({ ...args });
        if (tokens.length > 0) return true;
        else return false
    } catch (e) {
        console.log("err on isTokenExist ", e);
        return false
    }
}

export const getTokenById = async (tokenId: number): Promise<Token | null> => {
    try {
        let [token] = await knex<Token>("tokens").select().where({ id: tokenId });
        return token
    } catch (e) {
        console.log(e);
        return null
    }
}

export const getTokenByAddress = async (tokenAddress: string): Promise<Token | null> => {
    try {
        let [token] = await knex<Token>("tokens").select().where({ address: tokenAddress });
        return token
    } catch (e) {
        console.log("err on getTokenByAddress ", e);
        return null
    }
}

export const insertToken = async (args: Partial<Token>): Promise<void> => {
    try {
        await knex<Token>("tokens").insert(
            {
                ...args,
            },
            "*"
        );
    } catch (e) {
        console.log("err on insertToken ", e)
    }
}

export const deleteTokenIsPossible = async (args: Partial<Token>): Promise<boolean> => {
    try {
        let [token] = await knex<Token>("tokens").select().where({ ...args });
        console.log(token)
        if (!token) return false;
        else {
            let tables = await knex<Table>("tables").select().where({ payToken: token.id });
            let tournaments = await knex<Tournament>("tournamentTables").select().where({ payToken: token.id });

            if (tables.length > 0 || tournaments.length > 0) return false;
            else return true;
        }
    } catch (e) {
        console.log("err on deleteTokenIsPossible ", e);
        return false
    }
}

export const deleteToken = async (args: Partial<Token>): Promise<void> => {
    try {
        await knex("tokens").where({ ...args }).del();

    } catch (e) {
        console.log("err on deleteToken ", e);
    }
}

export async function updateToken(tokenId: number, newToken: Partial<Token>): Promise<void> {
    const knex = getKnex();
    await knex<Token>("tokens").update(newToken).where({ id: tokenId });
}