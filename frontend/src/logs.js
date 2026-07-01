// Helpers đổ log ra 4 panel: REST API, MQTT, InfluxDB, System Log.
import { state } from './state.js';

const $ = (id) => document.getElementById(id);

export function ts(epoch) {
  const d = epoch ? new Date(epoch) : new Date();
  return d.toLocaleTimeString('vi-VN');
}

function prepend(panelId, el, max = 60) {
  const box = $(panelId);
  if (!box) return;
  box.insertBefore(el, box.firstChild);
  while (box.children.length > max) box.removeChild(box.lastChild);
}

// ── REST API (sự kiện api_log: {ts, method, path, status, ms}) ───────────────
export function addApiLog(m) {
  state.counters.api++;
  state.lastApiMs = m.ms;
  $('apiCount').textContent = state.counters.api + ' calls';

  const sc = `s${m.status}`;
  const mc = { GET: 'log-get', POST: 'log-post', PUT: 'log-put', DELETE: 'log-del' }[m.method] || 'log-get';
  const div = document.createElement('div');
  div.className = 'log-entry';
  div.innerHTML =
    `<span class="log-ts">${ts(m.ts)}</span>` +
    `<span class="log-method ${mc}">${m.method}</span>` +
    `<span class="log-path">${m.path}</span>` +
    `<span class="log-status ${sc}">${m.status}</span>` +
    `<span class="log-ms">${m.ms}ms</span>`;
  prepend('apiLog', div);
}

// ── MQTT (sự kiện mqtt_log: {ts, type, topic, payload}) ──────────────────────
export function addMqttLog(m) {
  state.counters.mqtt++;
  $('mqttCount').textContent = state.counters.mqtt + ' msgs';

  const dirCls = m.type === 'PUB' ? 'mqtt-pub' : 'mqtt-sub';
  const div = document.createElement('div');
  div.className = 'mqtt-entry';
  div.innerHTML =
    `<span class="log-ts">${ts(m.ts)}</span>` +
    `<span class="mqtt-dir ${dirCls}">${m.type}</span>` +
    `<span class="mqtt-topic">${m.topic}</span>` +
    `<span class="mqtt-payload">${m.payload}</span>`;
  prepend('mqttLog', div);
}

// ── InfluxDB (sự kiện db_log: {ts, lp, measurement, tags, fields}) ───────────
export function addDbLog(m) {
  state.counters.db++;
  $('dbCount').textContent = state.counters.db + ' writes';

  const div = document.createElement('div');
  div.className = 'db-entry';
  // Hiển thị thẳng line-protocol thật từ backend
  div.innerHTML = `<span class="db-field" style="word-break:break-all;">${m.lp}</span>`;
  prepend('dbLog', div);
}

// ── System Log (feedback loop) ───────────────────────────────────────────────
export function sysLog(type, msg) {
  const box = $('syslog');
  if (!box) return;
  const cls = { phy: 'sl-phy', dig: 'sl-dig', fbk: 'sl-fbk', wrn: 'sl-wrn', inc: 'sl-inc' }[type] || 'sl-phy';
  const pfx = { phy: '→ PHY', dig: '  DIG', fbk: '← FBK', wrn: '⚠  WRN', inc: '🚨 INC' }[type] || '   ---';
  const div = document.createElement('div');
  div.className = 'sl-entry';
  div.innerHTML = `<span class="sl-ts">${ts()}</span><span class="${cls}">[${pfx}] ${msg}</span>`;
  prepend('syslog', div, 80);
}
