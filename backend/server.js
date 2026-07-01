'use strict';
require('dotenv').config();

const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const cors     = require('cors');
const morgan   = require('morgan');
const path     = require('path');

const config    = require('./src/config');
const db         = require('./src/db/timeseries');
const TwinEngine = require('./src/twin/engine');
const { startBroker }         = require('./src/mqtt/broker');
const createApiRouter          = require('./src/api');
const { registerSocketHandlers } = require('./src/socket/handler');

async function main() {
  // ── Express + Socket.io ───────────────────────────────────────────────────
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  });

  app.use(cors());
  app.use(express.json());
  app.use(morgan('dev'));
  app.use(express.static(path.join(__dirname, 'public')));

  // ── Persistent SQLite store (phải sẵn sàng trước khi engine ghi dữ liệu) ────
  await db.init();

  // ── Twin Engine (singleton) ───────────────────────────────────────────────
  const engine = new TwinEngine(io);

  // ── API logging → broadcast to all sockets ────────────────────────────────
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      io.emit('api_log', {
        ts:     Date.now(),
        method: req.method,
        path:   req.path,
        status: res.statusCode,
        ms:     Date.now() - start,
      });
    });
    next();
  });

  // ── Mount REST API ────────────────────────────────────────────────────────
  app.use('/api/v1', createApiRouter(engine));

  app.use((_req, res) => res.status(404).json({ success: false, error: 'Not found' }));

  // ── Socket.io connections ─────────────────────────────────────────────────
  io.on('connection', socket => {
    const n = io.engine.clientsCount;
    console.log(`[SOCKET] + ${socket.id}  (connected: ${n})`);
    registerSocketHandlers(socket, engine);
    socket.on('disconnect', () => {
      console.log(`[SOCKET] - ${socket.id}  (connected: ${io.engine.clientsCount})`);
    });
  });

  // ── MQTT broker ───────────────────────────────────────────────────────────
  try {
    await startBroker(io, engine);
  } catch (err) {
    console.warn('[MQTT] Broker failed to start:', err.message);
    console.warn('[MQTT] Continuing without MQTT (check if port 1883 is in use)');
  }

  // ── Start engine simulation loop ──────────────────────────────────────────
  engine.start();

  // ── Listen ────────────────────────────────────────────────────────────────
  httpServer.listen(config.PORT, () => {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║   Digital Twin Traffic — Backend Server           ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Web UI  →  http://localhost:${config.PORT}                  ║`);
    console.log(`║  REST    →  http://localhost:${config.PORT}/api/v1           ║`);
    console.log(`║  Socket  →  ws://localhost:${config.PORT}                    ║`);
    console.log(`║  MQTT    →  mqtt://localhost:${config.MQTT_TCP_PORT}               ║`);
    console.log(`║  MQTT/WS →  ws://localhost:${config.MQTT_WS_PORT}                 ║`);
    console.log('╚══════════════════════════════════════════════════╝\n');
  });
}

// ── Graceful shutdown: flush SQLite ra file trước khi thoát ──────────────────
function shutdown(sig) {
  console.log(`\n[${sig}] Đang lưu dữ liệu & tắt server…`);
  try { db.close(); } catch (_) { /* ignore */ }
  process.exit(0);
}
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
