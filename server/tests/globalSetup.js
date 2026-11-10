/**
 * Runs once before the test suite: creates the separate test database if needed,
 * applies the migrations and loads the seed data. The demo database is never touched.
 */
const knex = require('knex');
const config = require('../knexfile');

module.exports = async function setup() {
  const name = config.testDbName;
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error(`Invalid test database name: ${name}`);

  const server = knex({ client: 'mysql2', connection: { ...config.test.connection, database: undefined } });
  await server.raw(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await server.destroy();

  const db = knex(config.test);
  await db.migrate.latest();
  await db.seed.run();
  await db.destroy();
};
