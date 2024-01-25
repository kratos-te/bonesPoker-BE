import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table("tables", (table) => {
    table.integer("numSeats").notNullable();
    table.boolean("status").defaultTo(true);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table("tables", (table) => {
    table.dropColumn("numSeats");
    table.dropColumn("status");
  });
}
