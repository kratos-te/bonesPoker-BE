import { Knex } from "knex";
import { Action } from "../../types/Action";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("actionHistory", (table) => {
    table.increments("id").primary().unsigned();
    table.timestamp("createdAt").defaultTo(knex.fn.now());
    table.uuid("gameId").references("id").inTable("games").notNullable();
    table.uuid("playerId").references("id").inTable("players");
    table.string("socketId").notNullable();
    table.enum("action", Object.values(Action)).notNullable();
    table.integer("bet");
    table.integer("amount");
    table.string("comment");
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable("actionHistory");
}
