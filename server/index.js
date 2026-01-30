const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 25001,
  pingTimeout: 20000,
});

// Serve static playground UI
app.use(express.static(path.join(__dirname, '..', 'public')));

// Track rooms per namespace (in-memory for demo)
const nsRoomSockets = new Map(); // namespaceName -> Map(roomName -> Set of socketIds)

function attachNamespace(nsp) {
  const name = nsp.name;
  if (!nsRoomSockets.has(name)) nsRoomSockets.set(name, new Map());
  const roomSockets = nsRoomSockets.get(name);

  function getRoomsSnapshot() {
    const rooms = [];
    roomSockets.forEach((sockets, roomName) => rooms.push({ name: roomName, count: sockets.size }));
    return rooms;
  }

  nsp.on('connection', (socket) => {
    const auth = socket.handshake.auth;
    socket.emit('playground:auth_received', { auth });

    nsp.emit('playground:user_count', { count: nsp.sockets.size });
    nsp.emit('playground:rooms', getRoomsSnapshot());

    socket.on('room:join', (roomName, cb) => {
      const r = String(roomName || '').trim() || 'default';
      socket.join(r);
      if (!roomSockets.has(r)) roomSockets.set(r, new Set());
      roomSockets.get(r).add(socket.id);
      cb?.({ room: r, ok: true });
      nsp.emit('playground:rooms', getRoomsSnapshot());
    });

    socket.on('room:leave', (roomName, cb) => {
      const r = String(roomName || '').trim() || 'default';
      socket.leave(r);
      if (roomSockets.has(r)) {
        roomSockets.get(r).delete(socket.id);
        if (roomSockets.get(r).size === 0) roomSockets.delete(r);
      }
      cb?.({ room: r, ok: true });
      nsp.emit('playground:rooms', getRoomsSnapshot());
    });

    socket.on('playground:emit', ({ event, payload, target }) => {
      const data = { from: socket.id, payload, ts: Date.now() };
      if (target && target.type === 'room' && target.room) {
        nsp.to(target.room).emit(event, data);
      } else {
        nsp.emit(event, data);
      }
    });

    socket.onAny((eventName, ...args) => {
      if (eventName.startsWith('playground:') || eventName.startsWith('room:')) return;
      socket.emit('playground:echo', { event: eventName, args, ts: Date.now() });
    });

    socket.on('disconnect', () => {
      roomSockets.forEach((set, r) => {
        set.delete(socket.id);
        if (set.size === 0) roomSockets.delete(r);
      });
      nsp.emit('playground:user_count', { count: nsp.sockets.size });
      nsp.emit('playground:rooms', getRoomsSnapshot());
    });
  });
}

attachNamespace(io);
attachNamespace(io.of('/chat'));

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Socket.IO playground: http://localhost:${PORT}`);
});
