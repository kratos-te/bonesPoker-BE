import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table("games", (table) => {
    table.jsonb("winners");
    table.dropColumn("winner");
    table.dropColumn("winnerDesc");
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table("games", (table) => {
    table.dropColumn("winners");
    table.string("winner");
    table.string("winnerDesc");
  });
}
