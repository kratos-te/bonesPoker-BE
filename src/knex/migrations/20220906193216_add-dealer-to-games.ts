import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table("games", (table) => {
    table
      .uuid("dealer")
      .references("id")
      .inTable("players")
      .onDelete("SET NULL")
      .onUpdate("CASCADE");
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table("games", (table) => {
    table.dropColumn("dealer");
  });
}
