import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table("players", (table) => {
    table.boolean("active").notNullable().defaultTo(true);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table("players", (table) => {
    table.dropColumn("active");
  });
}
