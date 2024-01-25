import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table("players", (table) => {
    table.integer("bet");
    table.integer("lastBet").defaultTo(0);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table("players", (table) => {
    table.dropColumn("bet");
    table.dropColumn("lastBet");
  });
}
