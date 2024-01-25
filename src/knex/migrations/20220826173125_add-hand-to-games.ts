import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table("games", (table) => {
    table.integer("hand").defaultTo(0).notNullable();
    table.integer("updatedHand").defaultTo(1).notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table("games", (table) => {
    table.dropColumn("hand");
    table.dropColumn("updatedHand");
  });
}
