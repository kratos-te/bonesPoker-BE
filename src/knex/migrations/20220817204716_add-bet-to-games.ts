import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table("games", (table) => {
    table.integer("bet").notNullable().defaultTo(0);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table("games", (table) => {
    table.dropColumn("bet");
  });
}
