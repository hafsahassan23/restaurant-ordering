let io = null;

exports.setIo = (instance) => { io = instance; };
/** Send an event to one room (kitchen, waiters, table:<id>). Safe when io is not set (tests). */
exports.emit = (room, event, payload) => { if (io) io.to(room).emit(event, payload); };
exports.emitAll = (event, payload) => { if (io) io.emit(event, payload); };
/** Disconnect every socket in a room (e.g. phones using a QR token that was just replaced). */
exports.disconnectRoom = (room) => { if (io) io.in(room).disconnectSockets(true); };