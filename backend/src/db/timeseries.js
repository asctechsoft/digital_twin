'use strict';

/**
 * Time-series store backed by a REAL SQLite database (sql.js / WASM).
 *
 *  • Dữ liệu được ghi vào SQLite trong RAM (rất nhanh) và tự động flush ra file
 *    `data/twin.db` mỗi 5 giây + khi tắt server ⇒ KHÔNG mất dữ liệu khi restart.
 *  • File `.db` là SQLite chuẩn — có thể mở bằng DB Browser for SQLite để chấm báo cáo.
 *  • Giữ nguyên API cũ (write / query / queryLast / mean / stats / toLineProtocol)
 *    nên engine.js và các route không phải sửa gì.
 */
const fs   = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const config = require('../config');

let db = null;          // sql.js Database instance
let dbPath = null;
let dirty = 0;          // số ghi chưa flush
let writeCount = 0;     // tổng số ghi (cho stats)
let flushTimer = null;

// tags → chuỗi khoá đã sort, vd { loc:'hk01', dir:'NS' } → "dir=NS,loc=hk01"
function tagKey(tags = {}) {
  return Object.entries(tags).sort().map(([k, v]) => `${k}=${v}`).join(',');
}
function parseTagKey(key) {
  const tags = {};
  if (!key) return tags;
  for (const part of key.split(',')) {
    const i = part.indexOf('=');
    if (i > 0) tags[part.slice(0, i)] = part.slice(i + 1);
  }
  return tags;
}

// ── Khởi tạo (async — server.js phải await trước khi engine.start()) ──────────
async function init(customPath) {
  dbPath = path.resolve(customPath || config.DB_PATH);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const SQL = await initSqlJs();
  db = fs.existsSync(dbPath)
    ? new SQL.Database(fs.readFileSync(dbPath))   // nạp lại dữ liệu cũ
    : new SQL.Database();

  db.run(`CREATE TABLE IF NOT EXISTS points (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            measurement TEXT    NOT NULL,
            tagkey      TEXT    NOT NULL,
            ts          INTEGER NOT NULL,
            fields      TEXT    NOT NULL
          );`);
  db.run('CREATE INDEX IF NOT EXISTS idx_pts ON points(measurement, tagkey, ts);');

  // đếm số điểm đã có sẵn (từ lần chạy trước)
  const row = _one('SELECT COUNT(*) AS c FROM points');
  writeCount = row ? row.c : 0;

  flushTimer = setInterval(flush, 5000);
  console.log(`[DB] SQLite ready → ${dbPath} (${writeCount} điểm đã lưu trước đó)`);
  return module.exports;
}

// chạy 1 câu SELECT trả về mảng object
function _all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const out = [];
  while (stmt.step()) out.push(stmt.getAsObject());
  stmt.free();
  return out;
}
function _one(sql, params = []) {
  const rows = _all(sql, params);
  return rows[0] || null;
}

function _rowToPoint(r) {
  return { ts: r.ts, tags: parseTagKey(r.tagkey), fields: JSON.parse(r.fields) };
}

// ── Ghi 1 điểm ────────────────────────────────────────────────────────────────
function write(measurement, tags = {}, fields = {}, ts = Date.now()) {
  if (!db) return { measurement, tags, fields, ts }; // chưa init → bỏ qua an toàn
  db.run('INSERT INTO points (measurement, tagkey, ts, fields) VALUES (?,?,?,?)',
    [measurement, tagKey(tags), ts, JSON.stringify(fields)]);
  writeCount++;
  dirty++;
  return { measurement, tags, fields, ts };
}

// ── Truy vấn theo khoảng thời gian ────────────────────────────────────────────
function query(measurement, tags = {}, startTs = 0, endTs = Date.now()) {
  if (!db) return [];
  return _all(
    'SELECT ts, tagkey, fields FROM points WHERE measurement=? AND tagkey=? AND ts>=? AND ts<=? ORDER BY ts',
    [measurement, tagKey(tags), startTs, endTs]
  ).map(_rowToPoint);
}

// ── N điểm gần nhất ───────────────────────────────────────────────────────────
function queryLast(measurement, tags = {}, n = 30) {
  if (!db) return [];
  const rows = _all(
    'SELECT ts, tagkey, fields FROM points WHERE measurement=? AND tagkey=? ORDER BY ts DESC LIMIT ?',
    [measurement, tagKey(tags), n]
  ).map(_rowToPoint);
  return rows.reverse(); // trả về theo thứ tự thời gian tăng dần
}

// ── Trung bình 1 field trong windowMs mili-giây gần đây ───────────────────────
function mean(measurement, tags = {}, field = 'value', windowMs = 60_000) {
  const pts = query(measurement, tags, Date.now() - windowMs);
  if (!pts.length) return null;
  return pts.reduce((s, p) => s + (p.fields[field] || 0), 0) / pts.length;
}

// ── Thống kê ──────────────────────────────────────────────────────────────────
function stats() {
  if (!db) return { series: 0, totalPoints: 0, writes: 0, persisted: false };
  const total  = _one('SELECT COUNT(*) AS c FROM points');
  const series = _one('SELECT COUNT(DISTINCT measurement || tagkey) AS c FROM points');
  return {
    series: series ? series.c : 0,
    totalPoints: total ? total.c : 0,
    writes: writeCount,
    persisted: true,
    path: dbPath,
  };
}

// ── Flush RAM → file + dọn dữ liệu quá cũ (retention) ─────────────────────────
function flush() {
  if (!db || dirty === 0) return;
  // retention: chỉ giữ DB_RETENTION điểm mới nhất để file không phình vô hạn
  db.run('DELETE FROM points WHERE id <= (SELECT MAX(id) FROM points) - ?', [config.DB_RETENTION]);
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
  dirty = 0;
}

function close() {
  try { flush(); } catch (_) { /* ignore */ }
  if (flushTimer) clearInterval(flushTimer);
  if (db) { db.close(); db = null; }
}

// ── InfluxDB Line Protocol (chỉ để hiển thị log) ──────────────────────────────
function toLineProtocol(measurement, tags = {}, fields = {}, ts = Date.now()) {
  const tagStr = Object.entries(tags).map(([k, v]) => `${k}=${v}`).join(',');
  const fieldStr = Object.entries(fields).map(([k, v]) =>
    typeof v === 'string' ? `${k}="${v}"` : `${k}=${v}`
  ).join(',');
  return `${measurement},${tagStr} ${fieldStr} ${ts}`;
}

module.exports = { init, write, query, queryLast, mean, stats, flush, close, toLineProtocol };
