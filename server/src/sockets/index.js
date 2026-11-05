const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const tableRepository = require('../repositories/tableRepository');

/**
 * Rooms: "kitchen" (kitchen + manager), "waiters" (waiter, cashier, manager),
 * "table:<id>" (phones at that table).
 * Staff connect with { auth: { token } }, customers with { auth: { tableToken } }.
 */
module.exports = (io) => {
  io.use(async (socket, next) => {
    try {
      const { token, tableToken } = socket.handshake.auth || {};
      if (token) {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userRepository.findById(payload.sub);
        if (!user || !user.is_active) return next(new Error('unauthorized'));
        socket.data.user = user;
      } else if (tableToken) {
        const table = await tableRepository.findByToken(tableToken);
        if (!table) return next(new Error('unauthorized'));
        socket.data.table = table;
      } else {
        return next(new Error('unauthorized'));
      }
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { user, table } = socket.data;
    if (user) {
      if (['kitchen', 'manager'].includes(user.role)) socket.join('kitchen');
      if (['waiter', 'cashier', 'manager'].includes(user.role)) socket.join('waiters');
    }
    if (table) socket.join(`table:${table.id}`);
  });
};