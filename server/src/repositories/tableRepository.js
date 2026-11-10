const db = require('../db');

exports.findById = (id, trx = db) => trx('dining_tables').where({ id }).first();
/** Read a table and lock its row until the transaction ends (serialises billing of one table). */
exports.lockById = (id, trx) => trx('dining_tables').where({ id }).forUpdate().first();
exports.findByToken = (token) => db('dining_tables').where({ token }).first();
exports.list = () =>
  db('dining_tables')
    .leftJoin('users', 'dining_tables.assigned_waiter_id', 'users.id')
    .select('dining_tables.*', 'users.full_name as waiter_name')
    .orderBy('dining_tables.number');
exports.setStatus = (id, status, trx = db) => trx('dining_tables').where({ id }).update({ status });

exports.insert = (row) => db('dining_tables').insert(row).then(([id]) => id);
exports.update = (id, patch) => db('dining_tables').where({ id }).update(patch);
exports.remove = (id) => db('dining_tables').where({ id }).del();
exports.findByNumber = (number) => db('dining_tables').where({ number }).first();
exports.clearAssignment = (userId) => db('dining_tables').where({ assigned_waiter_id: userId }).update({ assigned_waiter_id: null });
exports.orderCount = async (id) => Number((await db('orders').where({ table_id: id }).count({ c: 'id' }).first()).c);