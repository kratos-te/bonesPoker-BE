import { Knex } from "knex";
import { GameMode } from "../../types/Game";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table("players", (table) => {
    table.boolean("folded").defaultTo(false);
    table.integer("reward");
    table.integer("rewardToken");
    table.enum("mode", Object.values(GameMode)).defaultTo(GameMode.TABLE);

    //     table.enum("action", Object.values(Action)).notNullable();

  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table("players", (table) => {
    table.dropColumn("folded");
    table.dropColumn("reward");
    table.dropColumn("rewardToken");
    table.dropColumn("mode");
  });
}
