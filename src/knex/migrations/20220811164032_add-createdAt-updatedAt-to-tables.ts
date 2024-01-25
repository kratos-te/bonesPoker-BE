import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table("tables", (table) => {
    table.timestamp("createdAt").defaultTo(knex.fn.now());
    table.timestamp("updatedAt").defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table("tables", (table) => {
    table.dropColumns("createdAt", "updatedAt");
  });
}
