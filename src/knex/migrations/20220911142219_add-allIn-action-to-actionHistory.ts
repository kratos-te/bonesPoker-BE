import { Knex } from "knex";
import { Action } from "../../types/Action";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table("actionHistory", (table) => {
    table.dropColumn("action");
  });
  await knex.schema.table("actionHistory", (table) => {
    table.enum("action", Object.values(Action));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table("actionHistory", (table) => {
    table.dropColumn("action");
  });
  await knex.schema.table("actionHistory", (table) => {
    table.enum("action", ["CALL", "RAISE", "CHECK", "FOLD", "ALL-IN"]);
  });
}
