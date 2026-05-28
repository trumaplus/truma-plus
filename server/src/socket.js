const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;
const connectedKiosks = new Map();

function initSocket(server) {
  const isProduction = process.env.NODE_ENV === 'production';
  io = new Server(server, {
    cors: isProduction
      ? false  // same-origin in production — no CORS needed
      : {
          origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:5173',
          methods: ['GET', 'POST'],
          credentials: true,
        },
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Kiosk registers itself
    socket.on('kiosk:register', ({ synagogueId, synagogueName, deviceInfo }) => {
      if (!synagogueId) return;
      socket.join(synagogueId);
      connectedKiosks.set(synagogueId, {
        socketId: socket.id,
        synagogueId,
        synagogueName: synagogueName || null,
        deviceInfo: deviceInfo || {},
        lastSeen: new Date(),
        connected: true,
      });
      io.to('admin-room').emit('kiosk:connected', { synagogueId, deviceInfo });
      console.log(`Kiosk registered: ${synagogueId}`);
    });

    // Kiosk sends status update
    socket.on('kiosk:status', (data) => {
      const { synagogueId } = data;
      if (!synagogueId) return;
      const entry = connectedKiosks.get(synagogueId);
      if (entry) {
        connectedKiosks.set(synagogueId, { ...entry, ...data, lastSeen: new Date() });
      }
      io.to('admin-room').emit('kiosk:status-update', data);
    });

    // Kiosk responds to ping
    socket.on('kiosk:pong', ({ synagogueId }) => {
      const entry = connectedKiosks.get(synagogueId);
      if (entry) connectedKiosks.set(synagogueId, { ...entry, lastSeen: new Date() });
    });

    // Admin joins admin room
    socket.on('admin:join', ({ token }) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role === 'admin') {
          socket.join('admin-room');
          socket.emit('admin:joined', { kiosks: Array.from(connectedKiosks.values()) });
        }
      } catch { /* invalid token */ }
    });

    // Admin or synagogue sends command to a kiosk
    socket.on('admin:command', ({ token, synagogueId, type, payload }) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Synagogue can only control their own kiosk
        if (decoded.role === 'synagogue' && decoded.synagogueId !== synagogueId) return;

        io.to(synagogueId).emit('admin:command', { type, payload });
      } catch { /* invalid token */ }
    });

    socket.on('disconnect', () => {
      for (const [synagogueId, kiosk] of connectedKiosks.entries()) {
        if (kiosk.socketId === socket.id) {
          connectedKiosks.delete(synagogueId);
          io.to('admin-room').emit('kiosk:disconnected', { synagogueId });
          console.log(`Kiosk disconnected: ${synagogueId}`);
          break;
        }
      }
    });
  });

  return io;
}

function getConnectedKiosks() {
  return Array.from(connectedKiosks.values()).map((k) => ({
    synagogueId: k.synagogueId,
    connected: true,
    lastSeen: k.lastSeen,
    deviceInfo: k.deviceInfo,
    currentState: { shabbatMode: k.shabbatMode, currentMedia: k.currentMedia },
  }));
}

function getIO() {
  return io;
}

module.exports = { initSocket, getConnectedKiosks, getIO };
