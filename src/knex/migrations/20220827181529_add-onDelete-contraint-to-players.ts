import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable("players", (table) => {
    table.dropForeign("gameId");
    table
      .foreign("gameId")
      .references("id")
      .inTable("games")
      .onDelete("CASCADE")
      .onUpdate("CASCADE");
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable("players", (table) => {
    table.dropForeign("gameId");
    table.foreign("gameId").references("id").inTable("games");
  });
}
