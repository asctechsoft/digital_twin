# 📐 Các Phương Trình & Mô Hình Toán Học — Digital Twin Nút Giao Thông

> Tổng hợp toàn bộ công thức hệ thống đang dùng, kèm ý nghĩa vật lý từng tham số.
> Mọi hằng số lấy trực tiếp từ `backend/src/config.js`. Cập nhật: **01/07/2026**.

**Ký hiệu chung**
- $d_i$ — mật độ hướng $i$, giá trị $[0,1]$ (0 = trống, 1 = tắc hoàn toàn). 4 hướng: NS, EW, NE, SW.
- $h$ — giờ mô phỏng $[0,23]$.
- $u = (ns_{green},\ ew_{green})$ — vector điều khiển: thời lượng đèn xanh (giây) trục Bắc–Nam và Đông–Tây.
- $\text{clamp}_{[a,b]}(x) = \min(b,\max(a,x))$.

---

## 1. Sinh mật độ xe (mô phỏng camera/sensor) — `simulator/generator.js`

### 1.1 Mật độ thô mỗi hướng

$$d_{raw}(dir, h) = \text{clamp}_{[0,1]}\big(\, base(dir)\cdot M(h) + \varepsilon \,\big), \qquad \varepsilon \sim \text{Uniform}(-0.06,\ +0.06)$$

| Tham số | Giá trị | Ý nghĩa vật lý |
|---|---|---|
| $base(dir)$ | NS=0.40, EW=0.30, NE=0.25, SW=0.20 | Lưu lượng nền của mỗi hướng khi vắng (NS là trục chính đông xe nhất) |
| $M(h)$ | bảng 24 mốc | Hệ số nhân theo giờ cao điểm |
| $\varepsilon$ | ±0.06 | Nhiễu ngẫu nhiên mô phỏng sai số đo của sensor |

### 1.2 Hệ số giờ cao điểm — nội suy tuyến tính

Giữa 2 mốc giờ liền kề $(h_i, m_i)$ và $(h_{i+1}, m_{i+1})$:

$$M(h) = m_i + \frac{h - h_i}{h_{i+1}-h_i}\,(m_{i+1}-m_i)$$

Một số mốc tiêu biểu: 3h → 0.12 (đêm vắng) · 8h → 1.90 (cao điểm sáng) · 17h → **2.00** (cao điểm chiều, đông nhất) · 22h → 0.45.

### 1.3 Hiệu chỉnh khi có sự cố

| Loại sự cố | Phương trình |
|---|---|
| **Tai nạn** (accident) | $NS' = \min(1,\ 1.7\cdot NS + 0.30)$; $\quad NE' = \min(1,\ 1.3\cdot NE)$ |
| **Xe ưu tiên** (emergency) | mọi hướng: $d' = \max(0.05,\ 0.65\cdot d)$ |
| **Đoàn VIP** (vip) | $NS' = \max(0.02,\ 0.08\cdot NS)$ (dọn đường cho đoàn xe) |

---

## 2. Động lực học đèn tín hiệu — `twin/engine.js`

### 2.1 Feedback đèn xanh
Mỗi tick, hướng nào đang đèn xanh thì mật độ giảm (xe được giải toả):

$$d \;\leftarrow\; \max(0,\ d - 0.04)$$

### 2.2 Chu kỳ đèn

$$C = ns_{green} + ew_{green} + 2\cdot Y, \qquad Y = 4\ \text{s (đèn vàng mỗi chiều)}$$

Pha đèn được xác định theo vị trí $t = \text{phaseTick} \bmod C$: NS xanh → NS vàng → EW xanh → EW vàng.

### 2.3 Đồng hồ mô phỏng
Mỗi giây thực trôi qua (nhân hệ số tốc độ $v$):

$$\text{hourFrac} \mathrel{+}= \frac{v}{3600}; \qquad \text{nếu } \text{hourFrac}\ge 1 \Rightarrow h \leftarrow (h+1)\bmod 24$$

### 2.4 Các chỉ số vận hành (KPI)
Với mật độ trung bình $\bar d = \dfrac{1}{4}\sum_i d_i$:

$$\text{throughput} = 220\,(1-\bar d) \quad\text{(xe/phút quy đổi)}$$
$$\text{avgWait} = 85\,\bar d \quad\text{(thời gian chờ TB, giây)}$$
$$\text{efficiency} = 100\,(1-\bar d) \quad\text{(hiệu suất nút giao, \%)}$$

---

## 3. 🧠 Hàm mục tiêu AI — What-if Optimizer — `ai/whatif.js`

> Đây là phương trình **cốt lõi** của "bộ não" hệ thống. Dạng bậc hai kinh điển trong
> điều khiển tối ưu (giống LQR): **phạt trạng thái xấu + phạt điều khiển mạnh**.

### 3.1 Hàm chi phí tổng

$$\boxed{\,J(u) = \underbrace{\sum_{i} w_i\, d_i^{2}}_{J_{cong}\ (\text{chi phí ùn tắc})} \;+\; \underbrace{\lambda \sum_{j}\left(\frac{\Delta u_j}{S}\right)^{2}}_{J_{chg}\ (\text{chi phí đổi đèn})}\,}$$

$$u^{*} = \arg\min_{u\,\in\,\{7\ \text{ứng viên}\}} J(u)$$

| Tham số | Giá trị | Ý nghĩa |
|---|---|---|
| $w_i$ | NS=EW=**1.0**; NE=SW=**0.6** | Trọng số ưu tiên — trục chính NS/EW quan trọng hơn hướng rẽ |
| $d_i^2$ | — | Bình phương ⇒ phạt **nặng** hướng nào quá đông (công bằng giữa các hướng) |
| $\lambda$ | **0.15** | Hệ số phạt việc thay đổi đèn — càng lớn càng "ngại" đổi |
| $\Delta u_j$ | $u_j^{cand} - u_j^{current}$ | Mức thay đổi thời lượng đèn so với hiện tại |
| $S$ | **30** s | Chuẩn hoá $\Delta u$ (đổi 30s ≈ 1 đơn vị) |

**Vì sao có $J_{chg}$?** Tránh AI ra lệnh đổi đèn giật cục gây sốc giao thông. Nếu chỉ tối ưu ùn tắc ($J_{cong}$) thì hệ thống có thể "nhảy" biên độ lớn mỗi chu kỳ — thực tế không mong muốn.

*Ví dụ đã kiểm chứng:* ứng viên tốt nhất 50/32 → $J = 0.8278_{(cong)} + 0.0057_{(chg)} = 0.8335$.

### 3.2 Mô hình dự báo 1 bước (Prediction)

Dùng để ước lượng $d_i$ trong công thức trên. Đặt tỉ lệ chia đèn xanh
$s_{ns} = \dfrac{ns}{ns+ew}$, $\ s_{ew} = \dfrac{ew}{ns+ew}$:

$$NS' = NS\,(1 - 0.30\,s_{ns}), \qquad EW' = EW\,(1 - 0.30\,s_{ew})$$
$$NE' = NE\,(1 - 0.15\,s_{ns}), \qquad SW' = SW\,(1 - 0.15\,s_{ew})$$

Ý nghĩa: hướng được chia **nhiều thời gian xanh hơn** thì xe thoát nhanh hơn ⇒ mật độ giảm mạnh hơn. Hệ số trục chính (0.30) gấp đôi hướng rẽ (0.15).

### 3.3 Phần trăm cải thiện

$$\text{improvement} = \frac{J_{cong}^{current} - J_{cong}^{best}}{J_{cong}^{current}}\times 100\ (\%)$$

Hệ thống chỉ khuyến nghị áp dụng khi $\text{improvement} > 5\%$.

---

## 4. Kiểm định độ trung thực mô hình (RMSE) — `ai/validation.js`

Chạy $N$ chu kỳ (mặc định 1000, quét đều 24 giờ), so **mô hình twin** (không nhiễu)
$\hat d(dir,h) = \text{clamp}_{[0,1]}\big(base(dir)\cdot M(h)\big)$ với **thực tế** có nhiễu $d^{actual}$:

$$\text{RMSE} = \sqrt{\frac{1}{N}\sum_{k=1}^{N}\big(\hat d_k - d_k^{actual}\big)^{2}}$$

$$\text{MAE} = \frac{1}{N}\sum_{k=1}^{N}\big|\hat d_k - d_k^{actual}\big|, \qquad \text{accuracy} \approx (1 - \text{RMSE})\times 100\%$$

*Kết quả đã chạy:* RMSE = **0.0346**, độ khớp **96.5%** — sát mức sàn nhiễu lý thuyết
$\sigma_\varepsilon = \dfrac{0.06}{\sqrt{3}} \approx 0.0346$ (độ lệch chuẩn của phân phối đều $\pm0.06$),
chứng tỏ mô hình khớp gần như hoàn hảo, sai số còn lại **chỉ do nhiễu sensor** chứ không phải sai lệch mô hình.

---

## 5. Bảng tổng hợp nhanh (để trình bày họp)

| Nhóm | Phương trình chính | Vai trò |
|---|---|---|
| **Sinh dữ liệu** | $d = \text{clamp}(base\cdot M(h) + \varepsilon)$ | Mô phỏng thế giới thực (Physical World) |
| **Điều khiển tối ưu (AI)** | $J = \sum w_i d_i^2 + \lambda\sum(\Delta u/S)^2$ | Chọn chu kỳ đèn tối ưu (LQR-style) |
| **Dự báo** | $d' = d\,(1 - k\cdot s)$ | Ước lượng trạng thái kế tiếp |
| **Kiểm định** | $\text{RMSE} = \sqrt{\frac1N\sum(\hat d - d)^2}$ | Đánh giá độ trung thực của twin |

> **Điểm nhấn học thuật:** hàm mục tiêu $J = \sum w_i d_i^2 + \lambda\sum \Delta u_j^2$ chính là
> dạng **hàm chi phí bậc hai (quadratic cost)** trong lý thuyết điều khiển tối ưu — cân bằng giữa
> *chất lượng trạng thái* (giảm ùn tắc) và *chi phí điều khiển* (hạn chế thay đổi đột ngột).
