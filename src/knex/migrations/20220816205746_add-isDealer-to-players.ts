import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table("players", (table) => {
    table.boolean("dealer").notNullable().defaultTo(false);
    table.boolean("smallBlind").notNullable().defaultTo(false);
    table.boolean("bigBlind").notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table("players", (table) => {
    table.dropColumn("dealer");
    table.dropColumn("smallBlind");
    table.dropColumn("bigBlind");
  });
}
