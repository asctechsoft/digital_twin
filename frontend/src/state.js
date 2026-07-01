// ─────────────────────────────────────────────────────────────────────────────
// State dùng chung cho cả app. Mọi giá trị ở đây được điền từ dữ liệu THẬT
// do backend đẩy về qua Socket.IO (sự kiện `state_update`, `ai_recommendation`).
// Vòng lặp animation (canvas.js) đọc liên tục object này để vẽ.
// ─────────────────────────────────────────────────────────────────────────────
export const state = {
  connected: false,

  // Mật độ hiện tại mỗi hướng (0..1) — chính là densities trong state vector
  S: { NS: 0, EW: 0, NE: 0, SW: 0 },

  // Lịch sử mật độ (mảng) để vẽ biểu đồ — backend gửi sẵn trong state_update.history
  history: { NS: [], EW: [], NE: [], SW: [] },

  // Tín hiệu đèn (lấy nguyên từ state_update.signal)
  signal: {
    nsGreen: 55, ewGreen: 35, yellow: 4, cycleLen: 98,
    phase: 'NS_GREEN', ns: 'green', ew: 'red', countdown: 0, phaseTick: 0,
  },

  incident: null,        // null | { type, dir, ts }
  kpis: { throughput: 0, avgWait: 0, efficiency: 0, optimizations: 0 },
  simHour: 0,
  tick: 0,
  db: { points: 0, measurements: 0 },

  // Khuyến nghị AI mới nhất (từ ai_recommendation) — nút Áp Dụng dùng best
  ai: null,

  // Bộ đếm log (chỉ để hiển thị)
  counters: { api: 0, mqtt: 0, db: 0 },

  // Thời điểm client bắt đầu (để tính uptime hiển thị)
  startTs: Date.now(),
  lastApiMs: 0,

  // Cờ điều khiển render cục bộ
  frozen: false,
};
