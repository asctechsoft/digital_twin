# 🚦 Digital Twin Nút Giao Thông — Công Nghệ & Tiến Độ

> Tài liệu tổng hợp cho buổi họp. Cập nhật: **01/07/2026**
> Dự án: mô phỏng "bản sao số" (Digital Twin) của một nút giao thông ở Hà Nội (`hk01` — Hoàn Kiếm / Đinh Tiên Hoàng), có AI đề xuất chu kỳ đèn tối ưu và giao diện 2D real-time.

---

## ⚠️ LƯU Ý QUAN TRỌNG ĐỌC TRƯỚC KHI HỌP

Tài liệu phân công cũ (`phan_cong_cong_viec.md`) viết theo hướng **Python** (FastAPI, Pydantic, Mosquitto, InfluxDB).
**Nhưng code thực tế đã được build bằng Node.js.** Bảng dưới đối chiếu:

| Hạng mục | Kế hoạch cũ (Python) | Thực tế đã code (Node.js) |
|---|---|---|
| Ngôn ngữ backend | Python | **Node.js (JavaScript)** |
| Web framework | FastAPI | **Express** |
| Realtime | (chưa rõ) | **Socket.IO** |
| MQTT Broker | Mosquitto / HiveMQ (cài ngoài) | **aedes** (broker nhúng trong process, không cần cài) |
| Time-series DB | InfluxDB (cài ngoài) | **In-memory TSDB tự viết** (giả lập InfluxDB, chưa lưu ổ cứng) |
| Schema validate | Pydantic | **Validate tay đơn giản** trong route (chưa có) |
| Frontend | HTML Canvas + Chart.js | **Vite + Vanilla JS + Canvas 2D** (vẽ chart tự viết) |

👉 **Cần chốt trong buổi họp:** giữ nguyên Node.js (đang chạy tốt) hay chuyển sang Python như đề bài? Khuyến nghị: **giữ Node.js**, chỉ cập nhật lại tài liệu báo cáo cho khớp.

---

## 1. Kiến Trúc Tổng Thể (5 Layer)

```
┌─ PHYSICAL WORLD (giả lập) ────────────┐      ┌─ DIGITAL WORLD (phần mềm) ─────────────┐
│ Layer 1: Data Generator (sensor giả)  │      │ Layer 4: Twin Engine + AI What-if      │
│ Layer 2: MQTT Broker (aedes)          │ ───► │ Layer 5: Frontend 2D real-time         │
│ Layer 3: Time-series DB + State       │      │          (Canvas + Dashboard)          │
└───────────────────────────────────────┘      └────────────────────────────────────────┘
        NGƯỜI 1 (Backend)                                 NGƯỜI 2 (Frontend/AI)
```

**Luồng dữ liệu 1 vòng (mỗi giây / 1 tick):**
```
generator.generate(gio_mo_phong)          → sinh mật độ 4 hướng (NS, EW, NE, SW)
   → engine._tick()                        → cập nhật đèn, KPI, phase
   → db.write() + MQTT publish             → lưu + phát telemetry
   → io.emit('state_update')               → đẩy State Vector x(t) xuống frontend
   → mỗi 3 tick: runWhatIf()               → AI tính 7 kịch bản, chọn tối ưu → emit
Frontend nhận qua Socket.IO → vẽ Canvas + panel + log real-time
Người dùng bấm "Áp dụng" → emit apply_signal → engine đổi đèn → publish lệnh MQTT
```

---

## 2. Công Nghệ Sử Dụng (Tech Stack)

### Backend — `D:\Digital Twins\backend`
| Thư viện | Phiên bản | Dùng để |
|---|---|---|
| **Node.js** | v20.18 | Runtime |
| **express** | ^4.19 | REST API (`/api/v1/...`) |
| **socket.io** | ^4.7 | Đẩy dữ liệu real-time xuống frontend |
| **aedes** | ^0.51 | MQTT broker nhúng (TCP 1883 + WS 8883) |
| **mqtt** | ^5.10 | Client MQTT nội bộ của engine (pub/sub) |
| **ws** | ^8.17 | Transport WebSocket cho MQTT |
| **cors, morgan, dotenv** | — | CORS, log HTTP, đọc file `.env` |
| **nodemon** (dev) | ^3.1 | Auto-reload khi sửa code |

### Frontend — `D:\Digital Twins\frontend`
| Thư viện | Phiên bản | Dùng để |
|---|---|---|
| **Vite** | ^5.4 | Dev server + build (port 5173) |
| **socket.io-client** | ^4.7 | Nối Socket.IO tới backend |
| **Vanilla JS + Canvas 2D** | — | Vẽ ngã tư, xe, đèn, biểu đồ (không dùng framework) |

> Không cần cài Python, Mosquitto, hay InfluxDB. Mọi thứ nằm trong Node.js.

---

## 3. NGƯỜI 1 — BACKEND: Phải làm gì / Đã làm gì / Còn thiếu

### 3.1 Danh sách đầu việc & trạng thái

| # | Đầu việc | File | Trạng thái | Ghi chú |
|---|---|---|---|---|
| 1 | **Data Generator** (sinh mật độ theo giờ + nhiễu + sự cố) | `src/simulator/generator.js` | ✅ **XONG** | Có profile 24h, nhiễu ±0.06, 3 loại sự cố (accident/emergency/vip) |
| 2 | **MQTT Broker** (aedes, TCP 1883 + WS 8883) | `src/mqtt/broker.js` | ✅ **XONG** | Broker nhúng, có client engine tự pub/sub |
| 3 | **Publisher / Subscriber** (pub telemetry, sub lệnh) | `src/mqtt/broker.js` + `engine.js` | ✅ **XONG** | Topic `traffic/hn/hk01/...` |
| 4 | **Time-series DB** (lưu + truy vấn telemetry) | `src/db/timeseries.js` | ⚠️ **XONG (in-memory)** | Circular buffer 1000 điểm, có Line Protocol. **Chưa lưu ổ cứng** — restart là mất |
| 5 | **Twin Engine / Update Module** (State Vector x(t)) | `src/twin/engine.js` | ✅ **XONG** | Vòng lặp tick, phase đèn, countdown, KPI |
| 6 | **REST API** (state, history, signal, incident, ai) | `src/api/**` | ✅ **XONG** | Xem mục 3.2 |
| 7 | **Socket.IO handlers** (đẩy state + nhận lệnh) | `src/socket/handler.js` | ✅ **XONG** | 6 event điều khiển + 2 query |
| 8 | **Schema Validator** (kiểu Pydantic) | — | ❌ **CHƯA** | Chỉ validate tay sơ sài trong route |
| 9 | **Lưu DB thật (InfluxDB / SQLite)** | — | ❌ **CHƯA** | Đang in-memory |
| 10 | **Nhiều nút giao** | `config.js` | ❌ **CHƯA** | Mới có 1 nút `hk01` |
| 11 | **Test tự động** | — | ❌ **CHƯA** | Chưa có unit/integration test |

### 3.2 REST API đã có (base: `http://localhost:3000/api/v1`)

| Method | Endpoint | Chức năng |
|---|---|---|
| GET | `/health` | Kiểm tra sống, uptime |
| GET | `/intersection/:id/state` | **State Vector x(t)** đầy đủ (mật độ, đèn, KPI, history) |
| GET | `/intersection/:id/history?dir=NS&n=30` | Lịch sử mật độ 1 hướng |
| GET | `/sensor/:loc/latest` | Mật độ mới nhất 4 hướng |
| POST | `/sensor/batch` | Nạp batch dữ liệu sensor (loc + readings[]) |
| GET | `/ai/scenarios` | Chạy What-if tươi ngay (7 kịch bản) |
| GET | `/ai/recommendation` | Lấy kết quả AI đã cache |
| GET | `/signal/:id/current` | Trạng thái đèn hiện tại + phase |
| PUT | `/signal/:id/command` | Đặt đèn `{ns_green, ew_green}` |
| POST | `/incident` | Kích hoạt sự cố `{type, dir}` |
| DELETE | `/incident/:loc` | Xoá sự cố |
| GET | `/incident/status` | Trạng thái sự cố |

### 3.3 MQTT Topics
| Topic | Chiều | Nội dung |
|---|---|---|
| `traffic/hn/hk01/sensor/{NS\|EW\|NE\|SW}` | Engine → | Mật độ + số xe mỗi hướng |
| `traffic/hn/hk01/signal/command` | ↔ | Lệnh đổi đèn (engine phát; client ngoài có thể phát để điều khiển) |
| `traffic/hn/hk01/incident/alert` | Engine → | Cảnh báo sự cố |

---

## 4. NGƯỜI 2 — FRONTEND/AI: Phải làm gì / Đã làm gì / Còn thiếu

### 4.1 Danh sách đầu việc & trạng thái

| # | Đầu việc | File | Trạng thái | Ghi chú |
|---|---|---|---|---|
| 1 | **What-if Engine + Optimizer** | `backend/src/ai/whatif.js` | ⚠️ **XONG (bản rút gọn)** | 7 kịch bản, hàm mục tiêu `J = Σ(d²)`, chọn min J. **Chưa có** phần regularization `λ·Σ(Δu)²` như đề bài |
| 2 | **Prediction Module** (dự báo state kế tiếp) | `whatif.js → simulateDensity()` | ⚠️ **XONG (1 bước, đơn giản)** | Dự báo 1 bước có yếu tố ngẫu nhiên, chưa phải mô hình chuẩn |
| 3 | **Sơ đồ 2D Canvas** (ngã tư, xe, đèn, đổi màu) | `frontend/src/canvas.js` | ✅ **XONG** | Vẽ 4 nhánh, xe chạy, đèn xanh/vàng/đỏ, đổi màu theo mật độ |
| 4 | **Dashboard KPI + biểu đồ mật độ** | `frontend/src/panels.js`, `canvas.js (drawChart)` | ✅ **XONG** | Biểu đồ tự vẽ trên Canvas (không dùng Chart.js) |
| 5 | **Panel đề xuất AI + nút "Áp dụng"** | `frontend/src/panels.js`, `controls.js` | ✅ **XONG** | Hiện 7 kịch bản, % cải thiện, nút áp dụng qua Socket |
| 6 | **Đồng hồ đếm ngược pha đèn** | `frontend/src/panels.js` | ✅ **XONG** | Countdown + thanh tiến trình |
| 7 | **Điều khiển thủ công + sự cố + tốc độ + giờ** | `frontend/src/controls.js` | ✅ **XONG** | Slider tốc độ ×0.5–10, slider giờ 0–23h, nút sự cố |
| 8 | **Log real-time** (API/MQTT/DB/System) | `frontend/src/logs.js` | ✅ **XONG** | 4 loại log chạy trực tiếp |
| 9 | **Báo cáo validation (RMSE, 1000 chu kỳ)** | — | ❌ **CHƯA** | Task 2.5 chưa làm — cần cho báo cáo |
| 10 | **Playback lịch sử / xuất dữ liệu** | — | ❌ **CHƯA** | Chưa có |

### 4.2 Cấu trúc frontend
| File | Vai trò |
|---|---|
| `main.js` | Điểm vào: init canvas + controls + mở socket |
| `socket.js` | Nối Socket.IO, map event → state → panel/log |
| `state.js` | State dùng chung |
| `canvas.js` | Vẽ ngã tư 2D + xe + đèn + biểu đồ |
| `panels.js` | Cập nhật DOM: đèn, mật độ, KPI, AI, health |
| `controls.js` | Slider/nút → emit socket + gọi REST |
| `logs.js`, `colors.js`, `config.js` | Log, thang màu, cấu hình URL backend |

---

## 5. CÁCH CHẠY (chi tiết từng bước)

> **Yêu cầu:** đã cài Node.js ≥ 18 (máy hiện tại: v20.18 ✅). `node_modules` của cả 2 bên **đã cài sẵn** — có thể chạy ngay.

### 5.1 Chạy Backend (Terminal 1)
```powershell
cd "D:\Digital Twins\backend"
npm install        # (bỏ qua nếu đã cài — hiện đã có node_modules)
npm start          # chạy server.js
```
Khi chạy đúng sẽ in bảng:
```
Web UI  →  http://localhost:3000
REST    →  http://localhost:3000/api/v1
Socket  →  ws://localhost:3000
MQTT    →  mqtt://localhost:1883
MQTT/WS →  ws://localhost:8883
```
- Nếu port 1883 bận → server vẫn chạy, chỉ cảnh báo bỏ MQTT (xem `server.js:66`).
- Dev mode auto-reload: `npm run dev` (dùng nodemon).

### 5.2 Chạy Frontend (Terminal 2)
```powershell
cd "D:\Digital Twins\frontend"
npm install        # (bỏ qua nếu đã cài)
npm run dev        # Vite dev server
```
→ Mở **http://localhost:5173**. Góc trên trái báo **"Đã kết nối backend"** là OK.

### 5.3 Thứ tự bắt buộc
1. **Bật backend trước** (port 3000) → 2. Bật frontend sau (port 5173).
2. Frontend nối backend qua `frontend/src/config.js` (mặc định `http://localhost:3000`).
   - Nếu chạy khác máy: `VITE_BACKEND_URL=http://192.168.x.x:3000 npm run dev`.

### 5.4 Cách test nhanh không cần frontend
```powershell
# Kiểm tra sống
curl http://localhost:3000/api/v1/health
# Lấy state đầy đủ
curl http://localhost:3000/api/v1/intersection/hk01/state
# Chạy AI what-if
curl http://localhost:3000/api/v1/ai/scenarios
# Đổi đèn
curl -X PUT http://localhost:3000/api/v1/signal/hk01/command -H "Content-Type: application/json" -d "{\"ns_green\":60,\"ew_green\":30}"
```

### 5.5 Build bản production (nếu cần demo gọn)
```powershell
cd "D:\Digital Twins\frontend"
npm run build      # tạo thư mục dist/
npm run preview    # xem thử bản build
```
> Ngoài ra có sẵn 2 file demo tĩnh mở trực tiếp bằng trình duyệt (không cần backend): `demo_simulation.html`, `hieu_de_tai.html`.

---

## 6. TÓM TẮT TIẾN ĐỘ (nói nhanh trong họp)

**✅ ĐÃ CHẠY ĐƯỢC END-TO-END:** sinh dữ liệu → MQTT → lưu DB (in-memory) → engine → Socket.IO → giao diện 2D real-time → AI đề xuất → áp dụng lệnh đổi đèn. Toàn hệ thống hoạt động liền mạch.

**⚠️ ĐANG Ở BẢN RÚT GỌN (nên nêu là "giới hạn"):**
- DB in-memory, chưa lưu ổ cứng (restart mất dữ liệu).
- AI What-if là mô hình 1 bước đơn giản, chưa có regularization `λ·Δu²`.
- Chưa có schema validation kiểu Pydantic.

**❌ CÒN THIẾU (việc cần chia tiếp):**
1. **Báo cáo validation RMSE 1000 chu kỳ** (Người 2) — cần cho điểm báo cáo.
2. **Lưu DB thật** (SQLite/InfluxDB) + schema validate (Người 1).
3. **Hoàn thiện hàm mục tiêu J** đúng công thức đề bài (Người 2).
4. Cập nhật lại tài liệu báo cáo cho khớp Node.js.
5. (Tuỳ chọn) test tự động, nhiều nút giao, playback lịch sử.

---

## 7. Các câu hỏi cần chốt trong họp
1. **Giữ Node.js hay chuyển Python?** (Khuyến nghị: giữ Node.js.)
2. Có cần **lưu DB thật** không, hay in-memory là đủ cho bài tập lớn?
3. Ai làm **báo cáo validation RMSE**? Deadline?
4. Chia lại đầu việc còn thiếu ở mục 6 cho 2 người.
