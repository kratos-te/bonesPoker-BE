import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("tables", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("public.gen_random_uuid()"));
    table.string("name");
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable("tables");
}
