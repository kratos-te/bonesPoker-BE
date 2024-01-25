import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table("games", (table) => {
    table.timestamp("startedAt");
    table.integer("numSeats");
    table.integer("minBet");
    table.integer("initialStack");
    table.integer("buyIn");
    table
      .enum("blindIncreaseMode", ["TIME", "ROUND"])
      .defaultTo("TIME");
    table.integer("blindIncreaseTime").defaultTo(0);
    table.integer("blindIncreaseRound").defaultTo(0);
    table.integer("blindIncreaseMulti").defaultTo(2);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table("games", (table) => {
    table.dropColumns("startedAt", "numSeats", "minBet", "initialStack", "buyIn", "blindIncreaseMode", "blindIncreaseTime", "blindIncreaseRound", "blindIncreaseMulti");
  });
}
