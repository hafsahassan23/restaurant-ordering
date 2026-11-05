const db = require('../db');

exports.findById = (id, trx = db) => trx('dining_tables').where({ id }).first();
exports.findByToken = (token) => db('dining_tables').where({ token }).first();
exports.list = () =>
  db('dining_tables')
    .leftJoin('users', 'dining_tables.assigned_waiter_id', 'users.id')
    .select('dining_tables.*', 'users.full_name as waiter_name')
    .orderBy('dining_tables.number');
exports.setStatus = (id, status, trx = db) => trx('dining_tables').where({ id }).update({ status });