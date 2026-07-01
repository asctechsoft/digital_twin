// Cập nhật mọi panel DOM từ `state`. Gọi từ socket.js mỗi khi có dữ liệu mới.
import { state } from './state.js';
import { getColor, phaseColor, DIRS } from './colors.js';

const $ = (id) => document.getElementById(id);
let prevAvg = null;

// ── ĐÈN TÍN HIỆU ─────────────────────────────────────────────────────────────
function fillFor(stateName, countdown, greenDur, yellowDur) {
  if (stateName === 'green') return Math.max(0, Math.min(100, (countdown / greenDur) * 100));
  if (stateName === 'yellow') return Math.max(0, Math.min(100, (countdown / yellowDur) * 100));
  return 100; // red
}

export function updateSignal() {
  const sig = state.signal;
  const nsCol = phaseColor(sig.ns), ewCol = phaseColor(sig.ew);
  const phName = (s) => (s === 'green' ? '🟢 XANH' : s === 'yellow' ? '🟡 VÀNG' : '🔴 ĐỎ');

  $('sig-ns-cd').textContent = sig.countdown;
  $('sig-ns-cd').style.color = nsCol;
  $('sig-ns-ph').textContent = phName(sig.ns);
  $('sig-ns-ph').style.color = nsCol;
  $('sig-ns-bar').style.width = fillFor(sig.ns, sig.countdown, sig.nsGreen, sig.yellow) + '%';
  $('sig-ns-bar').style.background = nsCol;

  $('sig-ew-cd').textContent = sig.countdown;
  $('sig-ew-cd').style.color = ewCol;
  $('sig-ew-ph').textContent = phName(sig.ew);
  $('sig-ew-ph').style.color = ewCol;
  $('sig-ew-bar').style.width = fillFor(sig.ew, sig.countdown, sig.ewGreen, sig.yellow) + '%';
  $('sig-ew-bar').style.background = ewCol;

  $('cycleLenLbl').textContent = sig.cycleLen + 's';
  $('phaseLbl').textContent = sig.phase;
  $('cycleNum').textContent = state.tick;

  // Đồng bộ ô nhập tay
  const ns = $('nsInput'), ew = $('ewInput');
  if (ns && document.activeElement !== ns) ns.value = sig.nsGreen;
  if (ew && document.activeElement !== ew) ew.value = sig.ewGreen;
}

// ── MẬT ĐỘ ───────────────────────────────────────────────────────────────────
export function updateDensityBars() {
  const container = $('densityBars');
  container.innerHTML = '';
  for (const dir of DIRS) {
    const d = state.S[dir], c = getColor(d);
    const row = document.createElement('div');
    row.className = 'dens-row';
    row.innerHTML =
      `<div class="dens-lbl">${dir}</div>
       <div class="dens-bg"><div class="dens-fill" style="width:${d * 100}%;background:${c.hex};"></div></div>
       <div class="dens-pct" style="color:${c.hex}">${Math.round(d * 100)}%</div>
       <div class="dens-ico">${c.emoji}</div>`;
    container.appendChild(row);
  }
}

// ── STATE VECTOR x(t) ────────────────────────────────────────────────────────
export function updateStateVector() {
  const S = state.S, sig = state.signal, k = state.kpis;
  $('stateVec').textContent =
`x(t) = {
  NS_density:  ${S.NS.toFixed(4)}  /* ${getColor(S.NS).label} */
  EW_density:  ${S.EW.toFixed(4)}  /* ${getColor(S.EW).label} */
  NE_density:  ${S.NE.toFixed(4)}  /* ${getColor(S.NE).label} */
  SW_density:  ${S.SW.toFixed(4)}  /* ${getColor(S.SW).label} */

  throughput:  ${k.throughput} veh/hr
  avg_wait:    ${k.avgWait}s
  efficiency:  ${k.efficiency}%

  signal: {
    NS_green: ${sig.nsGreen}s
    EW_green: ${sig.ewGreen}s
    phase:    "${sig.phase}"
    countdown: ${sig.countdown}s
    cycle:    ${sig.cycleLen}s
  }

  incident:    ${state.incident ? state.incident.type : 'none'}
  sim_hour:    ${state.simHour}h
  tick:        ${state.tick}
}`.trim();
}

// ── ANALYTICS ────────────────────────────────────────────────────────────────
export function updateAnalytics() {
  const avgHist = {};
  for (const dir of DIRS) {
    const h = state.history[dir];
    avgHist[dir] = h.length > 0 ? h.reduce((a, b) => a + b, 0) / h.length : 0;
  }
  const peak = Object.entries(state.S).sort((a, b) => b[1] - a[1])[0];
  const k = state.kpis;
  $('analyticsPanel').innerHTML = `
    <div style="font-size:0.72rem;color:var(--text2);line-height:2;">
      <div>Hướng đông đúc nhất: <strong style="color:${getColor(peak[1]).hex}">${peak[0]} (${Math.round(peak[1] * 100)}%)</strong></div>
      <div>TB lịch sử NS: <strong style="color:#60a5fa">${(avgHist.NS * 100).toFixed(1)}%</strong></div>
      <div>TB lịch sử EW: <strong style="color:#34d399">${(avgHist.EW * 100).toFixed(1)}%</strong></div>
      <div>Số điểm lịch sử/hướng: <strong style="color:#a78bfa">${state.history.NS.length}</strong></div>
      <div>Throughput hiện tại: <strong style="color:#22d3ee">${k.throughput} xe/giờ</strong></div>
      <div>Tối ưu AI đã áp dụng: <strong style="color:#fbbf24">${k.optimizations}</strong></div>
    </div>`;
}

// ── AI SCENARIOS (từ ai_recommendation) ──────────────────────────────────────
export function updateScenarios() {
  const ai = state.ai;
  if (!ai) return;
  $('aiConf').textContent = `J: ${ai.current.J} → ${ai.best.J}  (cải thiện +${ai.improvement}%)`;

  $('scenarioList').innerHTML = ai.candidates.slice(0, 5).map((c, i) => {
    const isBest = i === 0;
    return `<div class="sc-row">
      <span class="sc-badge ${isBest ? 'best' : ''}">${isBest ? '✅ TỐT NHẤT' : '#' + (i + 1)}</span>
      <span style="font-size:0.72rem;color:${isBest ? '#34d399' : '#94a3b8'}">NS=${c.nsGreen}s / EW=${c.ewGreen}s</span>
      <span class="sc-score ${isBest ? 'best' : ''}">J=${c.J}</span>
    </div>`;
  }).join('');

  const btn = $('applyBtn');
  if (btn && !btn.disabled) {
    btn.textContent = ai.shouldApply
      ? `✅ Áp Dụng: NS=${ai.best.nsGreen}s / EW=${ai.best.ewGreen}s`
      : '✅ Áp Dụng Đề Xuất Tốt Nhất';
  }
}

// ── KPI ROW ──────────────────────────────────────────────────────────────────
export function updateKPIs() {
  const k = state.kpis;
  const avg = DIRS.reduce((a, d) => a + state.S[d], 0) / 4;
  const avgPct = avg * 100;

  $('kpi-cycles').textContent = state.tick;
  $('kpi-decisions').textContent = k.optimizations;

  $('kpi-density').textContent = avgPct.toFixed(0) + '%';
  $('kpi-density').style.color = avg > 0.7 ? '#ef4444' : avg > 0.5 ? '#f97316' : avg > 0.3 ? '#eab308' : '#22c55e';
  if (prevAvg !== null) {
    const delta = (avgPct - prevAvg);
    $('kpi-density-d').textContent = (delta >= 0 ? '+' : '') + delta.toFixed(1) + '% vs trước';
    $('kpi-density-d').style.color = delta < 0 ? '#34d399' : delta > 0 ? '#f87171' : '#94a3b8';
  }
  prevAvg = avgPct;

  $('kpi-wait').textContent = k.avgWait + 's';
  $('kpi-wait').style.color = k.avgWait > 35 ? '#ef4444' : k.avgWait > 20 ? '#fbbf24' : '#34d399';
  $('kpi-throughput').textContent = k.throughput;
  $('kpi-eff').textContent = k.efficiency + '%';
}

// ── SYSTEM HEALTH (dùng số liệu thật ở chỗ có thể) ───────────────────────────
export function updateHealth() {
  const k = state.kpis;
  $('h-thr').textContent = k.throughput;
  $('h-thr-bar').style.width = Math.min(99, k.throughput / 2.2) + '%';

  $('h-lat').textContent = state.lastApiMs + 'ms';
  $('h-lat').style.color = state.lastApiMs > 50 ? '#f87171' : state.lastApiMs > 20 ? '#fbbf24' : '#34d399';
  $('h-lat-bar').style.width = Math.min(99, state.lastApiMs * 2) + '%';

  $('h-eff').textContent = k.efficiency + '%';
  $('h-eff-bar').style.width = k.efficiency + '%';

  $('h-db').textContent = state.db.points ?? 0;
  $('h-db-bar').style.width = Math.min(99, (state.db.points ?? 0) / 50) + '%';

  const up = Math.floor((Date.now() - state.startTs) / 1000);
  $('h-uptime').textContent = up + 's';
  $('h-uptime-bar').style.width = Math.min(99, up / 6) + '%';

  const imp = state.ai ? state.ai.improvement : 0;
  $('h-ai').textContent = imp + '%';
  $('h-ai-bar').style.width = Math.min(99, Math.max(2, imp * 4)) + '%';
}

// ── HEADER: giờ mô phỏng + đồng hồ thật ──────────────────────────────────────
export function updatePeriod() {
  const h = state.simHour;
  const period = (h >= 7 && h <= 9) ? '⛽ Cao điểm sáng'
    : (h >= 17 && h <= 19) ? '🔴 Cao điểm chiều'
    : (h >= 22 || h <= 5) ? '🌙 Khuya / Sáng sớm'
    : '☀️ Giờ bình thường';
  $('simPeriod').textContent = `Giờ mô phỏng: ${h}h — ${period}`;
}

// ── INCIDENT BADGE ───────────────────────────────────────────────────────────
export function updateIncidentBadge() {
  const badge = $('activeBadge');
  const inc = state.incident;
  if (!inc) { badge.style.display = 'none'; return; }
  const styles = {
    accident: 'background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3)',
    emergency: 'background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.3)',
    vip: 'background:rgba(167,139,250,0.15);color:#a78bfa;border:1px solid rgba(167,139,250,0.3)',
  };
  const labels = { accident: '🚗 TAI NẠN ĐANG XỬ LÝ', emergency: '🚑 XE CẤP CỨU ƯU TIÊN', vip: '🚨 VIP CONVOY ACTIVE' };
  badge.style.cssText = (styles[inc.type] || '') + ';display:block;padding:6px 10px;border-radius:7px;font-size:0.72rem;font-weight:700;margin-bottom:8px;animation:fadeIn .4s ease';
  badge.textContent = labels[inc.type] || inc.type;
}

// Gom cập nhật mỗi state_update
export function refreshFromState() {
  updateSignal();
  updateDensityBars();
  updateStateVector();
  updateAnalytics();
  updateKPIs();
  updateHealth();
  updatePeriod();
  updateIncidentBadge();
}
