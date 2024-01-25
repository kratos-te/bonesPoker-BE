import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("players", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("public.gen_random_uuid()"));
    table.uuid("tableId").references("id").inTable("tables");
    table.integer("seatId");
    table.string("socketId");
    table.string("address");
    // table.unique(["tableId", "address"]);
    // table.unique(["tableId", "seatId"]);
    // table.unique(["tableId", "socketId"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable("players");
}
