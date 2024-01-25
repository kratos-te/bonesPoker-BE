import { Table } from "../types/Table";
import { logError } from "../utils/Error";
import { getKnex } from "../knex";
const knex = getKnex();
export const getTableNameFromId = async (id: string) => {
    let tables = await knex<Table>("tables").select().where({ id });
    if (tables.length > 0) {
        return tables[0].name;
    } else {
        return "";
    }
}


export async function getTable(gameId: string): Promise<Table | null> {
    try {
        const [table] = await knex<Table>("tables").where({ id: gameId, status: true });
        return table;
    } catch (e) {
        logError("getTable", e);
        return null;
    }
}