import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table("games", (table) => {
    table.string("winnerDesc");
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table("games", (table) => {
    table.dropColumn("winnerDesc");
  });
}
