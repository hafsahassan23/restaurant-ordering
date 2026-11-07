const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const userRepository = require('../repositories/userRepository');
const tableRepository = require('../repositories/tableRepository');
const auditService = require('./auditService');

const view = (u) => ({ id: u.id, full_name: u.full_name, username: u.username, role: u.role, is_active: !!u.is_active });

exports.list = async () => (await userRepository.listAll()).map(view);

/** Create a staff account. Errors: 409 when the username is taken. */
exports.create = async (body, actor, ip) => {
  if (await userRepository.findByUsername(body.username)) {
    throw new AppError(409, 'This username is already used', 'USERNAME_TAKEN');
  }
  const id = await userRepository.insert({
    full_name: body.full_name,
    username: body.username,
    password_hash: await bcrypt.hash(body.password, 10),
    role_id: await userRepository.roleId(body.role),
    is_active: true,
  });
  await auditService.log({
    userId: actor.id, action: 'USER_CREATED', entity: 'user', entityId: id,
    details: { username: body.username, role: body.role }, ip,
  });
  return view(await userRepository.findById(id));
};

/**
 * Change name, role or active flag. A manager cannot disable or demote their own account.
 * A disabled user is rejected on their next request (authenticate checks is_active).
 */
exports.update = async (id, patch, actor, ip) => {
  const user = await userRepository.findById(id);
  if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');

  const disables = patch.is_active === false;
  const changesRole = patch.role !== undefined && patch.role !== user.role;
  if (id === actor.id && (disables || (patch.role !== undefined && patch.role !== 'manager'))) {
    throw new AppError(409, 'You cannot disable or demote your own account', 'SELF_CHANGE');
  }

  const row = {};
  if (patch.full_name !== undefined) row.full_name = patch.full_name;
  if (patch.role !== undefined) row.role_id = await userRepository.roleId(patch.role);
  if (patch.is_active !== undefined) row.is_active = patch.is_active;
  if (Object.keys(row).length > 0) await userRepository.update(id, row);

  // A waiter who is disabled or changes role must not keep tables
  if (user.role === 'waiter' && (disables || changesRole)) await tableRepository.clearAssignment(id);

  await auditService.log({ userId: actor.id, action: 'USER_UPDATED', entity: 'user', entityId: id, details: patch, ip });
  return view(await userRepository.findById(id));
};

exports.resetPassword = async (id, password, actor, ip) => {
  if (!(await userRepository.findById(id))) throw new AppError(404, 'User not found', 'NOT_FOUND');
  await userRepository.update(id, { password_hash: await bcrypt.hash(password, 10) });
  await auditService.log({ userId: actor.id, action: 'PASSWORD_RESET', entity: 'user', entityId: id, ip });
  return { ok: true };
};