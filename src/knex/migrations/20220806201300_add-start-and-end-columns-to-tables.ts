import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table("tables", (table) => {
    table.timestamp("startedAt");
    table.timestamp("endedAt");
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table("tables", (table) => {
    table.dropColumn("startedAt");
    table.dropColumn("endedAt");
  });
}
