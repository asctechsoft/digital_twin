// ─────────────────────────────────────────────────────────────────────────────
// Vẽ canvas: ngã tư 2D + xe + đèn tín hiệu, và biểu đồ mật độ lịch sử.
// Toàn bộ đọc dữ liệu THẬT từ `state` (do socket.js cập nhật).
// ─────────────────────────────────────────────────────────────────────────────
import { state } from './state.js';
import { getColor, DIRS } from './colors.js';

let cvMain, ctx, cvChart, ctx2;
let vehicles = [];
let animFrame = null;

const pathTypes = ['NS_in', 'NS_out', 'EW_in', 'EW_out', 'NE_in', 'SW_out'];

class Vehicle {
  constructor(pathType) {
    this.pathType = pathType;
    this.reset();
  }
  reset() {
    this.t = Math.random();
    this.speed = 0.003 + Math.random() * 0.004;
    const colors = ['#fbbf24', '#60a5fa', '#34d399', '#f87171', '#a78bfa', '#94a3b8'];
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.w = 12; this.h = 7;
    this.done = false;
  }
  getPos() {
    const W = cvMain.width, H = cvMain.height;
    const CX = W / 2, CY = H / 2;
    const IS = 58, ARM = 115;
    const t = this.t;
    switch (this.pathType) {
      case 'NS_in':  return { x: CX - 9, y: CY - IS - ARM * (1 - t), angle: Math.PI / 2 };
      case 'NS_out': return { x: CX + 9, y: CY + IS + ARM * t, angle: Math.PI / 2 };
      case 'EW_in':  return { x: CX - IS - ARM * (1 - t), y: CY - 9, angle: 0 };
      case 'EW_out': return { x: CX + IS + ARM * t, y: CY + 9, angle: 0 };
      case 'NE_in': {
        const s = Math.sqrt(0.5);
        return { x: CX - IS * s - ARM * s * (1 - t), y: CY - IS * s - ARM * s * (1 - t), angle: -Math.PI / 4 };
      }
      case 'SW_out': {
        const s = Math.sqrt(0.5);
        return { x: CX + IS * s + ARM * s * t, y: CY + IS * s + ARM * s * t, angle: -Math.PI / 4 };
      }
      default: return { x: CX, y: CY, angle: 0 };
    }
  }
  update(densityDir) {
    if (this.done) return;
    const density = densityDir || 0.3;
    const speedFactor = Math.max(0.1, 1 - density * 0.8);
    this.t += this.speed * speedFactor;
    if (this.t >= 1) this.done = true;
  }
  draw() {
    if (this.done) return;
    const { x, y, angle } = this.getPos();
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color; ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

function spawnVehicles() {
  const S = state.S;
  const densityMap = { NS_in: S.NS, NS_out: S.NS, EW_in: S.EW, EW_out: S.EW, NE_in: S.NE, SW_out: S.SW };
  for (const pt of pathTypes) {
    const d = densityMap[pt] || 0.2;
    const count = Math.round(d * 5 + 1);
    for (let i = 0; i < count; i++) vehicles.push(new Vehicle(pt));
  }
}

function drawIntersection() {
  if (!ctx) return;
  const S = state.S;
  const signalPhase = state.signal.phase;
  const incident = state.incident ? state.incident.type : null;

  const W = cvMain.width, H = cvMain.height;
  const CX = W / 2, CY = H / 2;
  const IS = 58, ARM = 115, RW = 62;

  ctx.clearRect(0, 0, W, H);

  const bg = ctx.createRadialGradient(CX, CY, 0, CX, CY, W * 0.65);
  bg.addColorStop(0, '#172035');
  bg.addColorStop(1, '#080c14');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(255,255,255,0.025)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  function drawArm(x1, y1, x2, y2, density) {
    const c = getColor(density);
    const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / len * RW / 2, ny = dx / len * RW / 2;

    ctx.beginPath();
    ctx.moveTo(x1 + nx * 1.4, y1 + ny * 1.4);
    ctx.lineTo(x2 + nx * 1.4, y2 + ny * 1.4);
    ctx.lineTo(x2 - nx * 1.4, y2 - ny * 1.4);
    ctx.lineTo(x1 - nx * 1.4, y1 - ny * 1.4);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();

    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, c.hex + 'dd');
    grad.addColorStop(0.4, c.hex + '99');
    grad.addColorStop(1, c.hex + '33');
    ctx.beginPath();
    ctx.moveTo(x1 + nx, y1 + ny);
    ctx.lineTo(x2 + nx, y2 + ny);
    ctx.lineTo(x2 - nx, y2 - ny);
    ctx.lineTo(x1 - nx, y1 - ny);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.shadowColor = c.hex; ctx.shadowBlur = 18; ctx.fill(); ctx.shadowBlur = 0;

    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 7]);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.setLineDash([]);

    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const lx = mx + nx * 0.6, ly = my + ny * 0.6;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath(); ctx.roundRect(lx - 22, ly - 10, 44, 20, 4); ctx.fill();
    ctx.fillStyle = c.hex;
    ctx.font = 'bold 11px "JetBrains Mono",monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(density * 100) + '%', lx, ly);
  }

  drawArm(CX, CY - IS, CX, CY - IS - ARM, S.NS);
  drawArm(CX, CY + IS, CX, CY + IS + ARM, S.NS);
  drawArm(CX - IS, CY, CX - IS - ARM, CY, S.EW);
  drawArm(CX + IS, CY, CX + IS + ARM, CY, S.EW);
  const d = Math.sqrt(0.5);
  drawArm(CX - IS * d, CY - IS * d, CX - IS * d - ARM * d, CY - IS * d - ARM * d, S.NE);
  drawArm(CX + IS * d, CY + IS * d, CX + IS * d + ARM * d, CY + IS * d + ARM * d, S.SW);

  ctx.fillStyle = '#1a2640';
  ctx.strokeStyle = 'rgba(100,130,200,0.25)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(CX - IS, CY - IS, IS * 2, IS * 2, 8); ctx.fill(); ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(CX - IS + 5 + i * 11, CY + IS, 7, 16);
    ctx.fillRect(CX - IS + 5 + i * 11, CY - IS - 16, 7, 16);
    ctx.fillRect(CX + IS + 2, CY - IS + 5 + i * 11, 16, 7);
    ctx.fillRect(CX - IS - 16, CY - IS + 5 + i * 11, 16, 7);
  }

  function drawLight(x, y, phase) {
    ctx.fillStyle = '#374151';
    ctx.fillRect(x - 2, y - 28, 4, 28);
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x - 9, y - 58, 18, 44, 4); ctx.fill(); ctx.stroke();

    const rOn = phase === 'RED';
    ctx.shadowBlur = rOn ? 14 : 0; ctx.shadowColor = '#ef4444';
    ctx.fillStyle = rOn ? '#ef4444' : '#374151';
    ctx.beginPath(); ctx.arc(x, y - 46, 5, 0, Math.PI * 2); ctx.fill();

    const yOn = phase === 'YELLOW';
    ctx.shadowBlur = yOn ? 14 : 0; ctx.shadowColor = '#fbbf24';
    ctx.fillStyle = yOn ? '#fbbf24' : '#374151';
    ctx.beginPath(); ctx.arc(x, y - 36, 5, 0, Math.PI * 2); ctx.fill();

    const gOn = phase === 'GREEN';
    ctx.shadowBlur = gOn ? 14 : 0; ctx.shadowColor = '#22c55e';
    ctx.fillStyle = gOn ? '#22c55e' : '#374151';
    ctx.beginPath(); ctx.arc(x, y - 26, 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  const nsPhase = signalPhase === 'NS_GREEN' ? 'GREEN' : (signalPhase === 'NS_YELLOW' ? 'YELLOW' : 'RED');
  const ewPhase = signalPhase === 'EW_GREEN' ? 'GREEN' : (signalPhase === 'EW_YELLOW' ? 'YELLOW' : 'RED');

  drawLight(CX - IS - 10, CY - IS, nsPhase);
  drawLight(CX + IS + 10, CY + IS, nsPhase);
  drawLight(CX - IS, CY - IS - 10, ewPhase);
  drawLight(CX + IS, CY + IS + 10, ewPhase);

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = 'bold 18px Inter';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('✚', CX, CY);

  ctx.font = 'bold 11px Inter'; ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('↑ NS', CX + RW * 0.9, CY - IS - ARM / 2);
  ctx.fillText('↓ NS', CX + RW * 0.9, CY + IS + ARM / 2);
  ctx.fillText('EW →', CX + IS + ARM / 2, CY - RW * 0.9);
  ctx.fillText('← EW', CX - IS - ARM / 2, CY - RW * 0.9);

  if (incident === 'accident') {
    ctx.fillStyle = 'rgba(239,68,68,0.12)'; ctx.fillRect(CX - IS, CY - IS, IS * 2, IS * 2);
    ctx.fillStyle = '#f87171'; ctx.font = 'bold 13px Inter'; ctx.fillText('⚠ ACCIDENT', CX, CY + 10);
  } else if (incident === 'emergency') {
    ctx.fillStyle = 'rgba(251,191,36,0.12)'; ctx.fillRect(CX - IS, CY - IS, IS * 2, IS * 2);
    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 13px Inter'; ctx.fillText('🚑 EMERGENCY', CX, CY + 10);
  } else if (incident === 'vip') {
    ctx.fillStyle = 'rgba(167,139,250,0.12)'; ctx.fillRect(CX - IS, CY - IS, IS * 2, IS * 2);
    ctx.fillStyle = '#a78bfa'; ctx.font = 'bold 13px Inter'; ctx.fillText('🚨 VIP', CX, CY + 10);
  }
}

// ── BIỂU ĐỒ MẬT ĐỘ (đọc state.history — dữ liệu thật từ backend) ──────────────
const lineColors = { NS: '#60a5fa', EW: '#34d399', NE: '#fbbf24', SW: '#f97316' };

export function drawChart() {
  if (!ctx2) return;
  const W = cvChart.width, H = cvChart.height;
  ctx2.clearRect(0, 0, W, H);

  ctx2.fillStyle = 'rgba(15,22,35,0.8)'; ctx2.fillRect(0, 0, W, H);

  ctx2.strokeStyle = 'rgba(255,255,255,0.05)'; ctx2.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const y = H - (H / 4) * i;
    ctx2.beginPath(); ctx2.moveTo(0, y); ctx2.lineTo(W, y); ctx2.stroke();
    ctx2.fillStyle = 'rgba(255,255,255,0.25)'; ctx2.font = '9px "JetBrains Mono"';
    ctx2.fillText((25 * i) + '%', 2, y - 2);
  }

  // Số điểm tối đa = độ dài history dài nhất hiện có (>=2 để vẽ)
  const maxLen = Math.max(2, ...DIRS.map((d) => state.history[d].length));
  for (const dir of DIRS) {
    const hist = state.history[dir];
    if (hist.length < 2) continue;
    ctx2.strokeStyle = lineColors[dir];
    ctx2.lineWidth = 2;
    ctx2.shadowColor = lineColors[dir]; ctx2.shadowBlur = 4;
    ctx2.beginPath();
    hist.forEach((v, i) => {
      const x = (i / (maxLen - 1)) * W;
      const y = H - v * H;
      i === 0 ? ctx2.moveTo(x, y) : ctx2.lineTo(x, y);
    });
    ctx2.stroke();
    ctx2.shadowBlur = 0;

    const lv = hist[hist.length - 1];
    const lx = ((hist.length - 1) / (maxLen - 1)) * W;
    const ly = H - lv * H;
    ctx2.fillStyle = lineColors[dir];
    ctx2.beginPath(); ctx2.arc(lx, ly, 3, 0, Math.PI * 2); ctx2.fill();
  }
}

// ── VÒNG LẶP ANIMATION ───────────────────────────────────────────────────────
function animLoop() {
  const S = state.S;
  vehicles = vehicles.filter((v) => !v.done);
  if (vehicles.length < 25) spawnVehicles();
  const dMap = { NS_in: S.NS, NS_out: S.NS, EW_in: S.EW, EW_out: S.EW, NE_in: S.NE, SW_out: S.SW };
  vehicles.forEach((v) => v.update(dMap[v.pathType]));

  drawIntersection();
  vehicles.forEach((v) => v.draw());

  animFrame = requestAnimationFrame(animLoop);
}

export function startAnimation() {
  if (animFrame) return;
  spawnVehicles();
  animLoop();
}

export function stopAnimation() {
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
}

export function initCanvas() {
  cvMain = document.getElementById('cvMain');
  ctx = cvMain.getContext('2d');
  cvChart = document.getElementById('cvChart');
  ctx2 = cvChart.getContext('2d');
  drawIntersection();
  drawChart();
}
