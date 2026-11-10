const crypto = require('crypto');
const AppError = require('../utils/AppError');
const tableRepository = require('../repositories/tableRepository');
const userRepository = require('../repositories/userRepository');
const auditService = require('./auditService');
const realtime = require('../realtime');

const newToken = () => crypto.randomBytes(16).toString('hex');
const audit = (user, action, id, details, ip) =>
  auditService.log({ userId: user.id, action, entity: 'table', entityId: id, details, ip });
const notify = (t) => realtime.emit('waiters', 'table:updated', { id: t.id, number: t.number, status: t.status });

async function assertWaiter(userId) {
  const u = await userRepository.findById(userId);
  if (!u || u.role !== 'waiter' || !u.is_active) {
    throw new AppError(400, 'Choose an active waiter', 'NOT_A_WAITER');
  }
}

async function mustFind(id) {
  const t = await tableRepository.findById(id);
  if (!t) throw new AppError(404, 'Table not found', 'TABLE_NOT_FOUND');
  return t;
}

/** Create a table with its own secret QR token. Errors: 409 when the number exists. */
exports.create = async (body, user, ip) => {
  if (await tableRepository.findByNumber(body.number)) {
    throw new AppError(409, 'Table number already exists', 'TABLE_NUMBER_TAKEN');
  }
  if (body.assignedWaiterId) await assertWaiter(body.assignedWaiterId);
  const id = await tableRepository.insert({
    number: body.number, area: body.area, seats: body.seats,
    token: newToken(), assigned_waiter_id: body.assignedWaiterId || null,
  });
  await audit(user, 'TABLE_CREATED', id, { number: body.number }, ip);
  const table = await tableRepository.findById(id);
  notify(table);
  return table;
};

/** Change number, area, seats, the Closed flag, or the waiter assigned to the table. */
exports.update = async (id, patch, user, ip) => {
  const table = await mustFind(id);
  if (patch.number !== undefined && patch.number !== table.number && (await tableRepository.findByNumber(patch.number))) {
    throw new AppError(409, 'Table number already exists', 'TABLE_NUMBER_TAKEN');
  }
  if (patch.assigned_waiter_id) await assertWaiter(patch.assigned_waiter_id);
  await tableRepository.update(id, patch);
  await audit(user, 'TABLE_UPDATED', id, patch, ip);
  const updated = await tableRepository.findById(id);
  notify(updated);
  return updated;
};

/** New secret token: the old QR code stops working at once (copied or misused QR). */
exports.regenerateQr = async (id, user, ip) => {
  await mustFind(id);
  await tableRepository.update(id, { token: newToken() });
  await audit(user, 'TABLE_QR_REGENERATED', id, null, ip);
  // Phones still connected with the old token stop receiving this table's live updates
  realtime.emit(`table:${id}`, 'table:token-revoked', {});
  realtime.disconnectRoom(`table:${id}`);
  return tableRepository.findById(id);
};

/** A table that ever had orders cannot be deleted (history); close it instead. */
exports.remove = async (id, user, ip) => {
  const table = await mustFind(id);
  if ((await tableRepository.orderCount(id)) > 0) {
    throw new AppError(409, 'This table has order history, close it instead', 'TABLE_IN_USE');
  }
  await tableRepository.remove(id);
  await audit(user, 'TABLE_DELETED', id, { number: table.number }, ip);
  notify({ id, number: table.number, status: 'free' });
  return { ok: true };
};