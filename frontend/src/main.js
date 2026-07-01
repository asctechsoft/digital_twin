// ─────────────────────────────────────────────────────────────────────────────
// Điểm vào của frontend.
//   1. Nạp CSS
//   2. Khởi tạo canvas + bắt đầu vòng lặp animation
//   3. Nối các điều khiển UI
//   4. import './socket.js' để mở kết nối Socket.IO và bắt đầu nhận dữ liệu thật
// ─────────────────────────────────────────────────────────────────────────────
import './style.css';
import { BACKEND_URL } from './config.js';
import { initCanvas, startAnimation } from './canvas.js';
import { initControls } from './controls.js';
import { sysLog } from './logs.js';
import './socket.js'; // mở kết nối Socket.IO (handlers tự đăng ký khi module nạp)

const $ = (id) => document.getElementById(id);

// Đồng hồ thật trên header
function tickClock() {
  $('clockDisp').textContent = new Date().toLocaleTimeString('vi-VN');
}

function boot() {
  $('apiBaseLbl').textContent = (BACKEND_URL || window.location.origin) + '/api/v1';

  initCanvas();
  startAnimation();
  initControls();

  tickClock();
  setInterval(tickClock, 1000);

  sysLog('phy', '🚀 Frontend khởi động — đang chờ State Vector x(t) từ backend…');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
