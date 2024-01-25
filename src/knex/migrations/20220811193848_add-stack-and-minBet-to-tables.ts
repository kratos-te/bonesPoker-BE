import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table("tables", (table) => {
    table.integer("minBet");
    table.integer("initialStack");
    table.integer("buyIn");
    table
      .enum("blindIncreaseMode", ["TIME", "ROUND"])
      .defaultTo("TIME");
    table.integer("blindIncreaseTime").defaultTo(0);
    table.integer("blindIncreaseRound").defaultTo(0);
    table.integer("blindIncreaseMulti").defaultTo(2);
    table.integer("payToken");
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table("tables", (table) => {
    table.dropColumn("minBet");
    table.dropColumn("initialStack");
    table.dropColumn("buyIn");
    table.dropColumn("blindIncreaseMode");
    table.dropColumn("blindIncreaseTime");
    table.dropColumn("blindIncreaseRound");
    table.dropColumn("blindIncreaseMulti");
    table.dropColumn("payToken");
  });
}
