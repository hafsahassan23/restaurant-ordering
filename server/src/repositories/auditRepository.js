const db = require('../db');

exports.insert = (row) => db('audit_logs').insert(row);

exports.latest = (limit = 100) =>
  db('audit_logs')
    .leftJoin('users', 'audit_logs.user_id', 'users.id')
    .select('audit_logs.*', 'users.username')
    .orderBy('audit_logs.id', 'desc')
    .limit(limit);