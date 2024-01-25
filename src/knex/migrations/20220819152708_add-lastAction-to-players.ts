import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table("players", (table) => {
    table.enum("lastAction", ["CALL", "RAISE", "CHECK", "FOLD"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table("players", (table) => {
    table.dropColumn("lastAction");
  });
}
