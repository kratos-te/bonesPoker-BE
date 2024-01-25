import { Knex } from "knex";
import { TournamentStatus } from "../../types/Tournament";
import { BlindIncreaseModes } from "../../types/Table";


export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable("tournamentTables", (table) => {
        table.uuid("id").primary().defaultTo(knex.raw("public.gen_random_uuid()"));
        table.string("name");
        table.integer("totalSeats");
        table.integer("tableSeats");
        table.integer("minBet");
        table.integer("initialStack");
        table.integer("buyIn");
        table.timestamp("createdAt").defaultTo(knex.fn.now());
        table.timestamp("updatedAt").defaultTo(knex.fn.now());
        table.timestamp("enterAt");
        table.timestamp("startAt");
        table.timestamp("endAt");
        table.enum("blindIncreaseMode", Object.values(BlindIncreaseModes)).defaultTo(BlindIncreaseModes.TIME);
        table.integer("blindIncreaseTime").defaultTo(0);
        table.integer("blindIncreaseRound").defaultTo(0);
        table.integer("blindIncreaseMulti").defaultTo(2);
        table.integer("payToken");
        table.enum("status", Object.values(TournamentStatus)).defaultTo(TournamentStatus.ACTIVE);
        table.jsonb("rewardPlan");
        table.jsonb("winners");
    });
}


export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable("tournamentTables");


}

