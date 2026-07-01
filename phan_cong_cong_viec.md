# 🚦 Phân Công Công Việc — Digital Twin Nút Giao Thông Thông Minh
> **Nhóm 2 người | Bài tập lớn môn Digital Twins (Thạc sĩ)**

---

## 🗺️ Tổng Quan Hệ Thống (Để Hiểu Trước Khi Chia)

```
┌──────────────────────────────────────────────────────────────────────┐
│                         ĐỀ TÀI CỦA NHÓM                             │
│                                                                      │
│  Physical World (Giả lập)   ←→   Digital World (Phần mềm)           │
│  ─────────────────────           ──────────────────────────          │
│  • Mock Data Generator           • Bộ não AI (What-if Engine)        │
│  • MQTT Broker                   • Dashboard + Sơ đồ 2D real-time   │
│  • Schema Validator              • Feedback Loop                     │
└──────────────────────────────────────────────────────────────────────┘
            ↑                                 ↑
      NGƯỜI 1 PHỤ TRÁCH                NGƯỜI 2 PHỤ TRÁCH
   (Backend / Data Engineer)         (Frontend / AI Engineer)
```

---

## 👤 NGƯỜI 1 — Backend & Data Pipeline

> **Biệt danh gợi ý**: *"Kỹ sư Hạ tầng"*
> **Vai trò cốt lõi**: Làm cho dữ liệu có thể chạy được — tức là xây dựng "phổi" và "mạch máu" của hệ thống.

### 🎯 Trách nhiệm chính

| STT | Công việc | Mô tả chi tiết | Layer |
|---|---|---|---|
| 1 | **Mock Data Generator** | Viết hàm Python sinh mật độ xe giả lập theo giờ cao điểm, hướng đi, nhiễu Gaussian | Layer 1 |
| 2 | **MQTT Broker Setup** | Cài đặt Mosquitto/HiveMQ, định nghĩa cấu trúc topic `traffic/{id}/{direction}` | Layer 2 |
| 3 | **Publisher / Subscriber** | Viết code publish dữ liệu lên MQTT, subscribe để nhận và ghi vào DB | Layer 2 |
| 4 | **Schema Validator** | Dùng Pydantic để validate telemetry JSON, định nghĩa `TrafficTelemetry` model | Layer 3 |
| 5 | **Asset & Ontology Model** | Khai báo JSON mô tả ngã tư, các hướng, đèn, quan hệ giữa chúng | Layer 3 |
| 6 | **Time-series Database** | Cài InfluxDB (hoặc SQLite để đơn giản), viết hàm lưu/truy vấn telemetry | Layer 3 |
| 7 | **Update Module** | Module nhận dữ liệu mới từ MQTT, cập nhật trạng thái Digital Twin State | Layer 4 |
| 8 | **API Backend** | Viết REST API (`FastAPI`) để Frontend gọi lấy trạng thái & gửi lệnh feedback | Layer 4 |

---

### 📋 Chi tiết code cần viết (Người 1)

#### ✅ Task 1.1 — Mock Data Generator
```python
# File: data_generator.py
def generate_traffic_density(direction, hour) -> float:
    # Phân phối Gaussian theo giờ cao điểm
    # 7-9h sáng và 17-19h chiều đông nhất
    ...

def run_publisher(interval_sec=5):
    # Liên tục publish dữ liệu lên MQTT mỗi 5 giây
    ...
```

#### ✅ Task 1.2 — Pydantic Schema
```python
# File: models.py
class ColorLevel(str, Enum): ...
class TrafficTelemetry(BaseModel): ...
```

#### ✅ Task 1.3 — MQTT Publisher/Subscriber
```python
# File: mqtt_client.py
def on_message(client, userdata, msg):
    # Parse JSON, validate bằng Pydantic, ghi vào DB
    ...
```

#### ✅ Task 1.4 — REST API Endpoints
```
GET  /api/state              → Trả về trạng thái hiện tại của Digital Twin
POST /api/feedback           → Nhận lệnh điều khiển từ Frontend (u*)
GET  /api/history?hours=1    → Lấy lịch sử mật độ 1 giờ qua
```

---

### ⏰ Gợi ý timeline (Người 1)

```
Tuần 1: Task 1.1 + 1.2 (Mock Data + Schema)
Tuần 2: Task 1.3 + Database (MQTT + lưu DB)
Tuần 3: Task 1.4 + Update Module (API + kết nối với Người 2)
Tuần 4: Test tích hợp + viết báo cáo phần Layer 1-3
```

---

---

## 👤 NGƯỜI 2 — Frontend & AI/Analytics Engine

> **Biệt danh gợi ý**: *"Kỹ sư Trí tuệ"*
> **Vai trò cốt lõi**: Làm cho hệ thống "thông minh" và "đẹp" — xây dựng "não" và "mặt" của hệ thống.

### 🎯 Trách nhiệm chính

| STT | Công việc | Mô tả chi tiết | Layer |
|---|---|---|---|
| 1 | **Prediction Module** | Viết hàm `predict_next_state()` mô phỏng mật độ xe sau khi áp dụng lệnh đèn | Layer 4 |
| 2 | **What-if Engine** | Viết hàm `what_if_analysis()` chạy N kịch bản, tính hàm J, chọn u* tối ưu | Layer 4 |
| 3 | **Optimizer** | Cài đặt hàm mục tiêu $J = \sum w_i \cdot x_i^2 + \lambda \cdot \sum \Delta u_j^2$ | Layer 4 |
| 4 | **Sơ đồ 2D Real-time** | Vẽ ngã tư bằng HTML Canvas/SVG, đổi màu theo mật độ, hiển thị đèn | Layer 5 |
| 5 | **Dashboard KPIs** | Biểu đồ mật độ theo thời gian thực (Chart.js hoặc D3.js) | Layer 5 |
| 6 | **AI Recommendation Panel** | Hiển thị đề xuất chu kỳ đèn tối ưu, nút "Áp dụng" gửi feedback | Layer 5 |
| 7 | **Đồng hồ đếm ngược** | Countdown timer cho pha đèn hiện tại | Layer 5 |
| 8 | **Báo cáo validation** | Chạy 1000 chu kỳ, so sánh mật độ dự báo vs thực tế, tính RMSE | Báo cáo |

---

### 📋 Chi tiết code cần viết (Người 2)

#### ✅ Task 2.1 — Prediction & What-if
```python
# File: prediction.py
class PredictionModule:
    def predict_next_state(self, state, action) -> dict:
        # Tính mật độ tiếp theo dựa trên thời gian đèn xanh
        ...

    def what_if_analysis(self, state, candidates) -> dict:
        # Chạy N kịch bản, tính J, trả về u* tốt nhất
        ...
```

#### ✅ Task 2.2 — Sơ đồ 2D (HTML Canvas)
```javascript
// File: intersection_canvas.js
function drawIntersection(densities) {
    // Vẽ ngã tư 4 hướng
    // Đổi màu từng nhánh theo mật độ
    // Hiển thị đèn xanh/đỏ/vàng
    // Hiển thị % mật độ dưới dạng nhãn
}
```

#### ✅ Task 2.3 — Dashboard Real-time
```javascript
// Dùng Chart.js để vẽ biểu đồ mật độ theo thời gian
// Cập nhật mỗi 5 giây qua polling hoặc WebSocket
```

#### ✅ Task 2.4 — Feedback UI
```javascript
// Nút "Áp dụng đề xuất AI"
async function applyRecommendation(u_star) {
    await fetch('/api/feedback', {
        method: 'POST',
        body: JSON.stringify(u_star)
    });
}
```

---

### ⏰ Gợi ý timeline (Người 2)

```
Tuần 1: Task 2.1 (Prediction Module + What-if Engine)
Tuần 2: Task 2.2 (Sơ đồ 2D Canvas)
Tuần 3: Task 2.3 + 2.4 (Dashboard + Feedback UI, kết nối API của Người 1)
Tuần 4: Task 2.5 (Chạy validation, tính RMSE) + viết báo cáo Layer 4-5
```

---

---

## 🤝 Điểm Kết Nối Giữa 2 Người (Integration Points)

> Hai người phải thống nhất **trước** các cấu trúc dữ liệu dùng chung dưới đây để tránh conflict khi ghép code.

### 📦 Cấu trúc JSON dùng chung (Phải thống nhất Tuần 1)

**1. Trạng thái hiện tại (State Object)**
```json
{
  "timestamp": "2026-06-29T17:30:00Z",
  "intersection_id": "hanoi_hoan_kiem_01",
  "state": {
    "NS": { "density": 0.78, "color_level": "RED", "vehicle_count": 42 },
    "EW": { "density": 0.25, "color_level": "GREEN", "vehicle_count": 8 }
  },
  "current_signal": { "NS_green": 45, "EW_green": 45 },
  "phase": "NS_GREEN",
  "countdown_sec": 23
}
```

**2. Lệnh điều khiển phản hồi (Feedback Command)**
```json
{
  "NS_green": 60,
  "EW_green": 30,
  "applied_by": "human",
  "timestamp": "2026-06-29T17:31:00Z"
}
```

**3. Kết quả What-if (AI Recommendation)**
```json
{
  "recommendation": { "NS_green": 60, "EW_green": 30 },
  "predicted_next_state": { "NS": 0.41, "EW": 0.45 },
  "score_J": 0.37,
  "scenarios_tested": 5
}
```

---

## 📊 Ma Trận Phân Công Tổng Hợp

| Hạng mục | Người 1 | Người 2 |
|---|---|---|
| **Mock Data Generator** | ✅ Chủ trách nhiệm | — |
| **MQTT Broker** | ✅ Chủ trách nhiệm | — |
| **Schema & Database** | ✅ Chủ trách nhiệm | — |
| **Update Module** | ✅ Chủ trách nhiệm | — |
| **REST API** | ✅ Chủ trách nhiệm | — |
| **Prediction Module** | — | ✅ Chủ trách nhiệm |
| **What-if / Optimizer** | — | ✅ Chủ trách nhiệm |
| **Sơ đồ 2D (Canvas)** | — | ✅ Chủ trách nhiệm |
| **Dashboard Charts** | — | ✅ Chủ trách nhiệm |
| **Feedback UI** | — | ✅ Chủ trách nhiệm |
| **Test tích hợp** | ✅ Cùng làm | ✅ Cùng làm |
| **Báo cáo Layer 1-3** | ✅ Chủ viết | — |
| **Báo cáo Layer 4-5** | — | ✅ Chủ viết |
| **Phần mở đầu & kết luận** | ✅ Cùng viết | ✅ Cùng viết |

---

## ⚠️ Những Rủi Ro & Cách Phòng Tránh

> [!WARNING]
> **Rủi ro 1**: Hai người viết code theo format JSON khác nhau → Hệ thống không kết nối được.
> **Giải pháp**: Thống nhất và lock cấu trúc JSON chung ở mục "Điểm Kết Nối" ngay Tuần 1.

> [!WARNING]
> **Rủi ro 2**: Người 2 không có dữ liệu để test UI trong khi chờ Người 1 xong Backend.
> **Giải pháp**: Người 2 tự tạo file `mock_state.json` tĩnh để test UI trước, sau đó thay bằng API thật.

> [!TIP]
> **Tip**: Dùng **Git** để cả 2 người cùng làm việc — Người 1 làm nhánh `backend`, Người 2 làm nhánh `frontend`, merge khi tích hợp.
