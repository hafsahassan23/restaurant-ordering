const db = require('../db');

const base = () =>
  db('users')
    .join('roles', 'users.role_id', 'roles.id')
    .select(
      'users.id', 'users.full_name', 'users.username',
      'users.password_hash', 'users.is_active', 'roles.name as role'
    );

/** Find a user (with role name) by username. */
exports.findByUsername = (username) => base().where('users.username', username).first();

/** Find a user (with role name) by id. */
exports.findById = (id) => base().where('users.id', id).first();
exports.listAll = () =>
  db('users')
    .join('roles', 'users.role_id', 'roles.id')
    .select('users.id', 'users.full_name', 'users.username', 'users.is_active', 'roles.name as role')
    .orderBy('users.id');
exports.roleId = async (name) => {
  const row = await db('roles').where({ name }).first();
  return row ? row.id : null;
};
exports.insert = (row) => db('users').insert(row).then(([id]) => id);
exports.update = (id, patch) => db('users').where({ id }).update(patch);