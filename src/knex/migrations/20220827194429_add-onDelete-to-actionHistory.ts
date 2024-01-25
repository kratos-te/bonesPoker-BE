import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable("actionHistory", (table) => {
    table.dropForeign("playerId");
    table
      .foreign("playerId")
      .references("id")
      .inTable("players")
      .onDelete("CASCADE")
      .onUpdate("CASCADE");
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
  return knex.schema.alterTable("actionHistory", (table) => {
    table.dropForeign("playerId");
    table.foreign("playerId").references("id").inTable("players");
    table.dropForeign("gameId");
    table.foreign("gameId").references("id").inTable("games");
  });
}
