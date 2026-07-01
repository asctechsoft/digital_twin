# Digital Twin Traffic — Frontend (Vite + Vanilla JS + Canvas)

Frontend trực quan hoá nút giao thông thông minh, **vẽ bằng Canvas 2D** và **nối backend real-time qua Socket.IO + REST**.

Đây là phiên bản "có hình vẽ đẹp" của `demo_simulation.html` nhưng dùng **dữ liệu thật** từ backend (`../backend`) thay vì dữ liệu giả tự sinh.

## Yêu cầu
- Node.js ≥ 18
- Backend đang chạy ở `http://localhost:3000` (xem `../backend`)

## Chạy

```bash
# 1) Khởi động backend (ở terminal khác)
cd ../backend
npm install
npm start            # http://localhost:3000

# 2) Khởi động frontend
cd ../frontend
npm install
npm run dev          # http://localhost:5173
```

Mở http://localhost:5173 — góc trên trái sẽ báo **"Đã kết nối backend"** khi Socket.IO bắt tay xong.

## Cấu hình kết nối
Sửa `src/config.js`:
- `BACKEND_URL = 'http://localhost:3000'` → gọi thẳng (backend đã bật CORS). **Mặc định.**
- `BACKEND_URL = ''` → đi qua proxy của Vite (`vite.config.js`), dùng khi muốn cùng origin.
- Hoặc đặt biến môi trường: `VITE_BACKEND_URL=http://192.168.1.10:3000 npm run dev`

## Luồng dữ liệu

```
Backend (Express + Socket.IO + MQTT + InfluxDB sim)
   │  emit: state_update, ai_recommendation, api_log, mqtt_log, db_log,
   │        signal_changed, incident_changed
   ▼
socket.js ──► state.js (state dùng chung)
   │              │
   │              ├─► canvas.js   (vẽ ngã tư + xe + đèn, vòng lặp rAF)
   │              ├─► panels.js   (đèn, mật độ, KPI, state vector, AI, health)
   │              └─► logs.js     (REST/MQTT/DB/System log)
   ▼
controls.js ──► emit: apply_signal, trigger_incident, clear_incident,
                      set_speed, set_hour  (+ REST PUT /signal/:id/command)
```

## Cấu trúc

| File | Vai trò |
|------|---------|
| `index.html`      | Layout (header, arch bar, canvas, panel, logs, KPI) |
| `src/main.js`     | Điểm vào: init canvas + controls + mở socket |
| `src/config.js`   | URL backend / REST base |
| `src/state.js`    | State dùng chung, điền từ dữ liệu thật |
| `src/socket.js`   | Kết nối Socket.IO + map sự kiện → state/panels/logs |
| `src/canvas.js`   | Vẽ ngã tư 2D, xe (class `Vehicle`), biểu đồ, vòng lặp animation |
| `src/panels.js`   | Cập nhật DOM: đèn, mật độ, KPI, state vector, analytics, AI, health |
| `src/logs.js`     | Đổ 4 loại log |
| `src/controls.js` | Slider/nút → socket emit + REST |
| `src/colors.js`   | Thang màu mật độ |

## Build production

```bash
npm run build        # → dist/
npm run preview      # xem thử bản build
```
