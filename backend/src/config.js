'use strict';

module.exports = {
  PORT: parseInt(process.env.PORT || '3000'),
  MQTT_TCP_PORT: parseInt(process.env.MQTT_TCP_PORT || '1883'),
  MQTT_WS_PORT: parseInt(process.env.MQTT_WS_PORT || '8883'),

  INTERSECTIONS: {
    hk01: {
      id: 'hk01',
      name: 'Hoàn Kiếm — Đinh Tiên Hoàng',
      location: { lat: 21.0285, lng: 105.8522 },
      defaultSignal: { nsGreen: 55, ewGreen: 35 },
    },
  },

  // Base density per direction (calm, no traffic)
  DIRECTION_BASES: {
    NS: 0.40,
    EW: 0.30,
    NE: 0.25,
    SW: 0.20,
  },

  // Hour-of-day traffic multiplier (linear interp between points)
  HOUR_PROFILES: [
    { hour: 0,  mult: 0.20 },
    { hour: 3,  mult: 0.12 },
    { hour: 6,  mult: 0.50 },
    { hour: 7,  mult: 1.60 },
    { hour: 8,  mult: 1.90 },
    { hour: 9,  mult: 1.40 },
    { hour: 10, mult: 1.10 },
    { hour: 11, mult: 1.20 },
    { hour: 12, mult: 1.35 },
    { hour: 13, mult: 1.20 },
    { hour: 14, mult: 1.00 },
    { hour: 15, mult: 1.15 },
    { hour: 16, mult: 1.55 },
    { hour: 17, mult: 2.00 },
    { hour: 18, mult: 1.90 },
    { hour: 19, mult: 1.50 },
    { hour: 20, mult: 1.10 },
    { hour: 21, mult: 0.70 },
    { hour: 22, mult: 0.45 },
    { hour: 23, mult: 0.30 },
  ],

  // 7 signal config candidates for AI what-if (ns + ew + 8s yellow = 90s cycle)
  AI_CANDIDATES: [
    { ns: 30, ew: 52 },
    { ns: 38, ew: 44 },
    { ns: 45, ew: 37 },
    { ns: 50, ew: 32 },
    { ns: 55, ew: 27 },
    { ns: 60, ew: 22 },
    { ns: 68, ew: 14 },
  ],

  YELLOW_DURATION: 4,  // seconds
  HISTORY_WINDOW: 60,  // ticks of density history per direction
  AI_INTERVAL_TICKS: 3,

  // ── AI objective function  J = Σ wᵢ·dᵢ²  +  λ·Σ Δuⱼ² ────────────────────────
  // wᵢ = trọng số ưu tiên từng hướng (hướng chính NS/EW nặng hơn rẽ NE/SW)
  OBJECTIVE_WEIGHTS: { NS: 1.0, EW: 1.0, NE: 0.6, SW: 0.6 },
  // λ = hệ số phạt việc đổi đèn quá mạnh (tránh giật cục). Δu tính theo giây,
  // chuẩn hoá bằng cách chia cho DELTA_U_SCALE trước khi bình phương.
  LAMBDA: 0.15,
  DELTA_U_SCALE: 30,   // giây — đổi 30s ≈ 1 đơn vị chuẩn hoá

  // ── Persistence (SQLite) ────────────────────────────────────────────────────
  DB_PATH: process.env.DB_PATH || 'data/twin.db',
  DB_RETENTION: parseInt(process.env.DB_RETENTION || '200000'), // giữ tối đa N điểm/measurement
};
