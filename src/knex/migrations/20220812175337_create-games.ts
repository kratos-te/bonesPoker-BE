import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("games", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("public.gen_random_uuid()"));
    table.uuid("tableId").notNullable();
    table.uuid("currentPlayerId").references("id").inTable("players");
    table.timestamp("createdAt").defaultTo(knex.fn.now());
    table.timestamp("updatedAt").defaultTo(knex.fn.now());
    table.integer("payToken");
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable("games");
}
