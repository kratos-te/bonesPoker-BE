import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable("tokens", (table) => {
        table.increments("id").primary().notNullable();
        table.string("name");
        table.string("address");
        table.integer("decimal");
    });
}


export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable("tokens");
}

