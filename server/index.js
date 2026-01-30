const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 25000,
  pingTimeout: 20000,
});

// Serve static playground UI
app.use(express.static(path.join(__dirname, '..', 'public')));

// Track rooms for UI (in-memory for demo)
const roomSockets = new Map(); // roomName -> Set of socketIds

io.on('connection', (socket) => {
  const auth = socket.handshake.auth;
  socket.emit('playground:auth_received', { auth });

  // Notify all clients of new connection (for playground "presence")
  io.emit('playground:user_count', { count: io.engine.clientsCount });

  socket.on('room:join', (roomName, cb) => {
    const name = String(roomName || '').trim() || 'default';
    socket.join(name);
    if (!roomSockets.has(name)) roomSockets.set(name, new Set());
    roomSockets.get(name).add(socket.id);
    cb?.({ room: name, ok: true });
    io.emit('playground:rooms', getRoomsSnapshot());
  });

  socket.on('room:leave', (roomName, cb) => {
    const name = String(roomName || '').trim() || 'default';
    socket.leave(name);
    if (roomSockets.has(name)) {
      roomSockets.get(name).delete(socket.id);
      if (roomSockets.get(name).size === 0) roomSockets.delete(name);
    }
    cb?.({ room: name, ok: true });
    io.emit('playground:rooms', getRoomsSnapshot());
  });

  // Generic custom event relay: broadcast to room or to all
  socket.on('playground:emit', ({ event, payload, target }) => {
    const data = { from: socket.id, payload, ts: Date.now() };
    if (target && target.type === 'room' && target.room) {
      io.to(target.room).emit(event, data);
    } else {
      io.emit(event, data);
    }
  });

  // Echo server for testing: any event name gets echoed to sender
  socket.onAny((eventName, ...args) => {
    // Skip internal playground events
    if (eventName.startsWith('playground:') || eventName.startsWith('room:')) return;
    socket.emit('playground:echo', { event: eventName, args, ts: Date.now() });
  });

  socket.on('disconnect', () => {
    roomSockets.forEach((set, room) => {
      set.delete(socket.id);
      if (set.size === 0) roomSockets.delete(room);
    });
    io.emit('playground:user_count', { count: io.engine.clientsCount });
    io.emit('playground:rooms', getRoomsSnapshot());
  });
});

function getRoomsSnapshot() {
  const rooms = [];
  roomSockets.forEach((sockets, name) => rooms.push({ name, count: sockets.size }));
  return rooms;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Socket.IO playground: http://localhost:${PORT}`);
});
