require('dotenv').config();

/**
 * Knex configuration. Two environments:
 * - development: the real database (DB_NAME) used by the app and the demo.
 * - test: a separate database (DB_NAME_TEST, default "<DB_NAME>_test") so running the
 *   tests never wipes the demo data. Selected with NODE_ENV=test (Vitest sets it) or `--env test`.
 */
const base = {
  client: 'mysql2',
  migrations: { directory: './migrations' },
  seeds: { directory: './seeds' },
};

const connection = (database) => ({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database,
});

const testDbName = process.env.DB_NAME_TEST || `${process.env.DB_NAME}_test`;

module.exports = {
  development: { ...base, connection: connection(process.env.DB_NAME) },
  test: { ...base, connection: connection(testDbName) },
  testDbName,
};
