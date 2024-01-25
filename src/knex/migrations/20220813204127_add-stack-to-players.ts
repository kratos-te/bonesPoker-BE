import { Knex } from "knex";
export async function up(knex: Knex): Promise<void> {
  return knex.schema.table("players", (table) => {
    table.integer("stack");
    table
      .enum("lastStreet", ["INIT", "PREFLOP", "FLOP", "TURN", "RIVER"])
      .defaultTo("INIT");

  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table("players", (table) => {
    table.dropColumn("stack");
    table.dropColumn("lastStreet");
  });
}
