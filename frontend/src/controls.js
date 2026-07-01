// Nối các điều khiển UI tới backend (socket emit + REST) và tương tác cục bộ.
import { socket } from './socket.js';
import { state } from './state.js';
import { API_BASE, INTERSECTION_ID } from './config.js';
import { startAnimation, stopAnimation } from './canvas.js';
import { sysLog } from './logs.js';

const $ = (id) => document.getElementById(id);

export function initControls() {
  // ── TABS ───────────────────────────────────────────────────────────────────
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      $('tab-' + btn.dataset.tab).classList.add('active');
      btn.classList.add('active');
    });
  });

  // ── SLIDER: TỐC ĐỘ → set_speed ─────────────────────────────────────────────
  const speed = $('speedSlider');
  speed.addEventListener('input', () => { $('speedVal').textContent = speed.value + '×'; });
  speed.addEventListener('change', () => {
    socket.emit('set_speed', { multiplier: parseFloat(speed.value) });
  });

  // ── SLIDER: GIỜ MÔ PHỎNG → set_hour ────────────────────────────────────────
  const hour = $('hourSlider');
  hour.addEventListener('input', () => { $('hourVal').textContent = hour.value + 'h'; });
  hour.addEventListener('change', () => {
    socket.emit('set_hour', { hour: parseInt(hour.value) });
  });

  // ── AI: ÁP DỤNG ĐỀ XUẤT TỐT NHẤT → apply_signal ────────────────────────────
  $('applyBtn').addEventListener('click', () => {
    if (!state.ai) return;
    const { nsGreen, ewGreen } = state.ai.best;
    const btn = $('applyBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Gửi lệnh tới Physical World…';
    socket.emit('apply_signal', { ns_green: nsGreen, ew_green: ewGreen, src: 'FE-AI-Apply' });
    sysLog('dig', `Gửi lệnh AI: NS=${nsGreen}s / EW=${ewGreen}s qua Socket`);
    setTimeout(() => {
      btn.textContent = '✅ Đã Áp Dụng!';
      btn.style.background = 'linear-gradient(135deg,#1d4ed8,#1e40af)';
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = '✅ Áp Dụng Đề Xuất Tốt Nhất';
        btn.style.background = '';
      }, 2500);
    }, 600);
  });

  // ── ĐẶT ĐÈN THỦ CÔNG (Socket) ──────────────────────────────────────────────
  $('applyManual').addEventListener('click', () => {
    const ns = parseInt($('nsInput').value);
    const ew = parseInt($('ewInput').value);
    socket.emit('apply_signal', { ns_green: ns, ew_green: ew, src: 'FE-Manual' });
    sysLog('dig', `Đặt đèn thủ công (Socket): NS=${ns}s / EW=${ew}s`);
  });

  // ── ĐẶT ĐÈN QUA REST (PUT) ──────────────────────────────────────────────────
  $('restApplyBtn').addEventListener('click', async () => {
    const ns = parseInt($('nsInput').value);
    const ew = parseInt($('ewInput').value);
    try {
      await fetch(`${API_BASE}/signal/${INTERSECTION_ID}/command`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ns_green: ns, ew_green: ew, src: 'FE-REST' }),
      });
      sysLog('dig', `Đặt đèn qua REST PUT: NS=${ns}s / EW=${ew}s`);
    } catch (err) {
      sysLog('wrn', `REST lỗi: ${err.message}`);
    }
  });

  // ── SỰ CỐ → trigger_incident / clear_incident ──────────────────────────────
  $('incAccident').addEventListener('click', () => socket.emit('trigger_incident', { type: 'accident', dir: 'NS' }));
  $('incEmergency').addEventListener('click', () => socket.emit('trigger_incident', { type: 'emergency' }));
  $('incVip').addEventListener('click', () => socket.emit('trigger_incident', { type: 'vip', dir: 'NS' }));
  $('incReset').addEventListener('click', () => socket.emit('clear_incident'));

  // ── FREEZE ANIMATION (chỉ dừng vẽ phía client, backend vẫn chạy) ────────────
  $('freezeBtn').addEventListener('click', () => {
    state.frozen = !state.frozen;
    if (state.frozen) {
      stopAnimation();
      $('freezeBtn').textContent = '▶ Chạy animation';
    } else {
      startAnimation();
      $('freezeBtn').textContent = '⏸ Dừng animation';
    }
  });
}
