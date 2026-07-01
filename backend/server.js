'use strict';
require('dotenv').config();

const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const cors     = require('cors');
const morgan   = require('morgan');
const path     = require('path');
const fs       = require('fs');

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
    cors: { origin: config.CORS_ORIGIN },
    transports: ['websocket', 'polling'],
  });

  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(express.json());
  app.use(morgan('dev'));

  // ── Phục vụ frontend đã build (frontend/dist) nếu có, nếu không thì public/ ──
  const frontendDir = fs.existsSync(path.join(config.FRONTEND_DIST, 'index.html'))
    ? config.FRONTEND_DIST
    : path.join(__dirname, 'public');
  app.use(express.static(frontendDir));
  console.log(`[WEB] Phục vụ giao diện từ: ${frontendDir}`);

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

  // API không tồn tại → JSON 404
  app.use('/api', (_req, res) => res.status(404).json({ success: false, error: 'Not found' }));

  // Mọi route GET còn lại → trả index.html (để mở http://VPS:PORT ra thẳng giao diện)
  app.get('*', (_req, res) => {
    const indexFile = path.join(frontendDir, 'index.html');
    if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
    res.status(404).json({ success: false, error: 'Not found' });
  });

  // ── Socket.io connections ─────────────────────────────────────────────────
  io.on('connection', socket => {
    const n = io.engine.clientsCount;
    console.log(`[SOCKET] + ${socket.id}  (connected: ${n})`);
    registerSocketHandlers(socket, engine);
    socket.on('disconnect', () => {
      console.log(`[SOCKET] - ${socket.id}  (connected: ${io.engine.clientsCount})`);
    });
  });

  // ── MQTT broker (có thể tắt bằng ENABLE_MQTT=false) ─────────────────────────
  if (config.ENABLE_MQTT) {
    try {
      await startBroker(io, engine);
    } catch (err) {
      console.warn('[MQTT] Broker failed to start:', err.message);
      console.warn('[MQTT] Continuing without MQTT (check if port 1883 is in use)');
    }
  } else {
    console.log('[MQTT] Bị tắt qua ENABLE_MQTT=false');
  }

  // ── Start engine simulation loop ──────────────────────────────────────────
  engine.start();

  // ── Listen (0.0.0.0 để truy cập được từ ngoài VPS) ──────────────────────────
  httpServer.listen(config.PORT, config.HOST, () => {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║   Digital Twin Traffic — Backend Server           ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Nghe tại  →  ${config.HOST}:${config.PORT}`);
    console.log(`║  Web UI    →  http://<IP_VPS>:${config.PORT}`);
    console.log(`║  REST      →  http://<IP_VPS>:${config.PORT}/api/v1`);
    console.log(`║  Socket    →  ws://<IP_VPS>:${config.PORT}`);
    if (config.ENABLE_MQTT) {
      console.log(`║  MQTT      →  mqtt://<IP_VPS>:${config.MQTT_TCP_PORT}  |  ws://<IP_VPS>:${config.MQTT_WS_PORT}`);
    }
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
