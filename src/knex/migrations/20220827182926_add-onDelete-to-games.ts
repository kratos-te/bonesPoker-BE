import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable("games", (table) => {
    table.dropForeign("currentPlayerId");
    table
      .foreign("currentPlayerId")
      .references("id")
      .inTable("players")
      .onDelete("SET NULL")
      .onUpdate("CASCADE");
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable("games", (table) => {
    table.dropForeign("currentPlayerId");
    table.foreign("currentPlayerId").references("id").inTable("players");
  });
}
