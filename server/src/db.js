/** Shared Knex instance. Uses the test database when NODE_ENV=test (see knexfile.js). */
const knex = require('knex');
const config = require('../knexfile');

module.exports = knex(process.env.NODE_ENV === 'test' ? config.test : config.development);
