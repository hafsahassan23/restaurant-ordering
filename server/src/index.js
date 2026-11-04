require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: 'http://localhost:5173' } });
app.set('io', io);

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));