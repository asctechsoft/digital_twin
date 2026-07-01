// ─────────────────────────────────────────────────────────────────────────────
// Kết nối Socket.IO tới backend và ánh xạ các sự kiện real-time vào `state`.
// Sự kiện backend phát (xem backend/src/socket/handler.js & engine.js):
//   state_update, ai_recommendation, mqtt_log, api_log, db_log,
//   signal_changed, incident_changed, speed_changed, hour_changed
// ─────────────────────────────────────────────────────────────────────────────
import { io } from 'socket.io-client';
import { BACKEND_URL } from './config.js';
import { state } from './state.js';
import { refreshFromState, updateScenarios } from './panels.js';
import { drawChart } from './canvas.js';
import { addApiLog, addMqttLog, addDbLog, sysLog } from './logs.js';
import { getColor } from './colors.js';

// Nếu BACKEND_URL rỗng → io() tự nối cùng origin (qua proxy Vite).
export const socket = BACKEND_URL ? io(BACKEND_URL, { transports: ['websocket', 'polling'] }) : io();

const $ = (id) => document.getElementById(id);

function setConnected(ok) {
  state.connected = ok;
  $('liveDot').classList.toggle('off', !ok);
  $('badge-socket').className = 'sys-badge ' + (ok ? 'online' : 'off');
  $('connTxt').textContent = ok
    ? 'Đã kết nối backend · ' + socket.id.slice(0, 6)
    : 'Mất kết nối — đang thử lại…';
}

// ── CONNECTION ───────────────────────────────────────────────────────────────
socket.on('connect', () => {
  setConnected(true);
  sysLog('dig', `📡 Socket.IO đã kết nối tới backend (${BACKEND_URL || 'same-origin'})`);
});

socket.on('disconnect', () => {
  setConnected(false);
  sysLog('wrn', 'Socket.IO mất kết nối tới backend');
});

socket.on('connect_error', (err) => {
  setConnected(false);
  sysLog('wrn', `Không nối được backend: ${err.message} — kiểm tra backend đã chạy ở ${BACKEND_URL}?`);
});

// ── STATE VECTOR x(t) — nhịp tim của hệ thống ────────────────────────────────
socket.on('state_update', (s) => {
  state.S = s.densities;
  state.history = s.history;
  state.signal = s.signal;
  state.incident = s.incident;
  state.kpis = s.kpis;
  state.simHour = s.sim_hour;
  state.tick = s.tick;
  if (s.db) state.db = s.db;

  refreshFromState();
  drawChart();
});

// ── AI WHAT-IF ───────────────────────────────────────────────────────────────
socket.on('ai_recommendation', (r) => {
  state.ai = r;
  updateScenarios();
  if (r.shouldApply) {
    sysLog('dig', `AI đề xuất NS=${r.best.nsGreen}s/EW=${r.best.ewGreen}s — cải thiện +${r.improvement}% (J=${r.best.J})`);
  }
});

// ── LOGS THẬT TỪ BACKEND ─────────────────────────────────────────────────────
socket.on('api_log', addApiLog);
socket.on('mqtt_log', addMqttLog);
socket.on('db_log', addDbLog);

// ── SỰ KIỆN ĐIỀU KHIỂN ───────────────────────────────────────────────────────
socket.on('signal_changed', (e) => {
  sysLog('fbk', `✅ Đèn cập nhật bởi ${e.src} → NS=${e.next.nsGreen}s / EW=${e.next.ewGreen}s`);
});

socket.on('incident_changed', (e) => {
  if (e.active) sysLog('inc', `Sự cố kích hoạt: [${(e.type || '').toUpperCase()}]${e.dir ? ' hướng ' + e.dir : ''}`);
  else sysLog('fbk', 'Sự cố đã xử lý — hệ thống trở về bình thường');
});

socket.on('speed_changed', (e) => sysLog('dig', `Tốc độ engine: ×${e.multiplier}`));
socket.on('hour_changed', (e) => sysLog('dig', `Giờ mô phỏng đặt thành ${e.hour}h`));

// Cảnh báo mật độ cao (tính phía client từ state)
let warnTick = 0;
socket.on('state_update', (s) => {
  if (++warnTick % 5 !== 0) return; // bớt spam, 5 tick/lần
  if (s.densities.NS > 0.75 || s.densities.EW > 0.75) {
    sysLog('wrn', `Mật độ cao! NS=${Math.round(s.densities.NS * 100)}%${getColor(s.densities.NS).emoji} EW=${Math.round(s.densities.EW * 100)}%${getColor(s.densities.EW).emoji}`);
  }
});
