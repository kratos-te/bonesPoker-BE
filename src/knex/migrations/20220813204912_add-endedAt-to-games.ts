import { Knex } from "knex";
import { GameMode } from "../../types/Game";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table("games", (table) => {
    table.timestamp("endedAt");
    table.boolean("ended").defaultTo(false);
    table.enum("mode", Object.values(GameMode))
      .defaultTo(GameMode.TABLE);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table("games", (table) => {
    table.dropColumn("endedAt");
    table.boolean("ended").defaultTo(false);
    table.dropColumn("mode");
  });
}
