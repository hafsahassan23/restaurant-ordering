/**
 * Payments get a status (PENDING / SUCCESS / FAILED), a unique transaction reference,
 * new demo methods (WAAFI, QR, card) and safe payer info. Only SUCCESS rows count as paid.
 * Card numbers and CVV are never stored: only a masked label such as "VISA •••• 4242".
 * "cash" stays in the enum so old receipts still read correctly; new cash payments are refused.
 */
exports.up = async (knex) => {
  await knex.schema.alterTable('payments', (t) => {
    t.enu('method', ['cash', 'evc_plus', 'zaad', 'edahab', 'waafi', 'qr', 'card']).notNullable().alter();
    t.enu('status', ['PENDING', 'SUCCESS', 'FAILED']).notNullable().defaultTo('SUCCESS');
    t.string('payer_masked', 40).nullable();
    t.string('failure_reason', 120).nullable();
    t.string('idempotency_key', 64).nullable().unique();
    t.timestamp('completed_at').nullable();
  });
  // Older rows (cash) had no reference: give each one so the column can be unique
  await knex.raw("UPDATE payments SET reference = CONCAT('LEGACY-', id) WHERE reference IS NULL");
  await knex.raw('UPDATE payments SET completed_at = created_at WHERE completed_at IS NULL');
  await knex.schema.alterTable('payments', (t) => {
    t.string('reference', 60).notNullable().alter();
    t.unique(['reference']);
    t.index(['bill_id', 'status']);
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('payments', (t) => {
    t.dropIndex(['bill_id', 'status']);
    t.dropUnique(['reference']);
    t.dropUnique(['idempotency_key']);
    t.dropColumn('status');
    t.dropColumn('payer_masked');
    t.dropColumn('failure_reason');
    t.dropColumn('idempotency_key');
    t.dropColumn('completed_at');
  });
  await knex.raw("DELETE FROM payments WHERE method IN ('waafi','qr','card')");
  await knex.schema.alterTable('payments', (t) => {
    t.enu('method', ['cash', 'evc_plus', 'zaad', 'edahab']).notNullable().alter();
    t.string('reference', 60).nullable().alter();
  });
};
