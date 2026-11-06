exports.up = (knex) =>
  knex.schema.alterTable('orders', (t) => {
    t.integer('bill_id').unsigned().nullable().references('id').inTable('bills');
  });

exports.down = (knex) =>
  knex.schema.alterTable('orders', (t) => {
    t.dropForeign('bill_id');
    t.dropColumn('bill_id');
  });