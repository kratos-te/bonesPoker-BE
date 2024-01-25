import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table("games", (table) => {
    table
      .enum("street", ["PREFLOP", "FLOP", "TURN", "RIVER"])
      .defaultTo("PREFLOP");
    table.jsonb("communityCards");
    table.jsonb("prevCommunityCards");
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table("games", (table) => {
    table.dropColumn("street");
    table.dropColumn("communityCards");
    table.dropColumn("prevCommunityCards");
  });
}
