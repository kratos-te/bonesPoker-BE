import { Knex } from "knex";
import { Action } from "../../types/Action";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table("players", (table) => {
    table.dropColumn("lastAction");
  });
  await knex.schema.table("players", (table) => {
    table.enum("lastAction", Object.values(Action));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table("players", (table) => {
    table.dropColumn("lastAction");
  });
  await knex.schema.table("players", (table) => {
    table.enum("lastAction", ["CALL", "RAISE", "CHECK", "FOLD"]);
  });
}
