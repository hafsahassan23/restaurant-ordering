const db = require('../db');

exports.insert = (row) => db('sms_outbox').insert(row);
exports.latest = (limit = 100) => db('sms_outbox').orderBy('id', 'desc').limit(limit);