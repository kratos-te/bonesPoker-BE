import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable("users", (table) => {
        table.string("address").primary().notNullable();
        table.string("name");
        table.string("pfp");
        table.timestamp("createdAt").defaultTo(knex.fn.now());
        table.boolean("status").defaultTo(true);
    });
}


export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable("users");


}

