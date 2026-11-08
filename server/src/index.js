require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const origins = require('./origins');
const realtime = require('./realtime');
const registerSockets = require('./sockets');

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: origins } });
realtime.setIo(io);
registerSockets(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));