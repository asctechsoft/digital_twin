# 🚀 Hướng Dẫn Deploy Lên VPS (1 port duy nhất)

Backend đã được chỉnh để **phục vụ luôn frontend** → chỉ cần mở **1 cổng (3000)**, không còn lỗi `localhost`.
Truy cập `http://<IP_VPS>:3000` là ra thẳng giao diện; API ở `/api/v1`, socket cùng origin.

---

## A. Chuẩn bị trên máy (đẩy code lên VPS)

Đẩy **cả 2 thư mục** `backend/` và `frontend/` lên VPS, giữ nguyên cấu trúc cạnh nhau:
```
digital-twin/
├── backend/
└── frontend/
```
> ⚠️ ĐỪNG copy `node_modules` và `frontend/dist` từ Windows lên — cài lại trên VPS (bước B).
> Dùng git, scp, hoặc rsync. Ví dụ: `scp -r backend frontend user@IP_VPS:~/digital-twin/`

---

## B. Trên VPS (Linux) — các bước chạy

```bash
# 1) Cài Node.js ≥ 18 (nếu chưa có)
node -v          # kiểm tra; cần >= 18

cd ~/digital-twin/backend

# 2) Tạo file .env từ mẫu, chỉnh nếu cần
cp .env.example .env
nano .env        # sửa PORT / ENABLE_MQTT / CORS_ORIGIN nếu muốn

# 3) Cài dependencies + BUILD frontend + chạy thử (1 lệnh)
npm run deploy
```
`npm run deploy` sẽ: `npm install` (backend) → build frontend → `node server.js`.
Thấy dòng `Nghe tại → 0.0.0.0:3000` là OK. Mở trình duyệt: `http://<IP_VPS>:3000`.

> Muốn tách bước: `npm install` → `npm run build:frontend` → `npm start`.

---

## C. Mở firewall (rất hay quên!)

```bash
sudo ufw allow 3000/tcp        # cổng web + API
# Nếu KHÔNG dùng MQTT từ ngoài, không cần mở 1883/8883.
# Không cần MQTT thì đặt ENABLE_MQTT=false trong .env cho gọn.
```
Nếu VPS có Security Group (AWS/GCP/Azure/Vultr…), mở cổng 3000 trong bảng điều khiển nhà cung cấp.

---

## D. Chạy nền lâu dài với PM2 (khuyến nghị)

```bash
sudo npm install -g pm2
cd ~/digital-twin/backend

# build frontend trước (chỉ cần 1 lần, hoặc mỗi khi sửa frontend)
npm install && npm run build:frontend

pm2 start ecosystem.config.js
pm2 logs digital-twin          # xem log
pm2 save && pm2 startup        # tự chạy lại sau khi VPS reboot (làm theo dòng lệnh nó in ra)
```
Lệnh PM2 hữu ích: `pm2 restart digital-twin` · `pm2 stop digital-twin` · `pm2 status`.

---

## E. (Tuỳ chọn) Chạy sau Nginx + domain + HTTPS

Nếu muốn dùng domain thay vì `:3000`, đặt Nginx reverse proxy:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;      # cho WebSocket/Socket.IO
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
Rồi cài HTTPS miễn phí: `sudo certbot --nginx -d your-domain.com`.
Khi dùng domain, nên đặt `CORS_ORIGIN=https://your-domain.com` trong `.env`.

---

## F. Kiểm tra nhanh backend đã chạy đúng

```bash
curl http://localhost:3000/api/v1/health                       # {"ok":true,...}
curl http://localhost:3000/api/v1/ai/scenarios                 # kết quả AI
curl "http://localhost:3000/api/v1/validation/rmse?cycles=1000" # RMSE
curl -I http://localhost:3000/                                  # HTTP 200, text/html
```

---

## G. Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân & cách sửa |
|---|---|
| `EADDRINUSE :3000` | Port bị chiếm → `lsof -i :3000` rồi kill, hoặc đổi `PORT` trong `.env` |
| Web mở được nhưng "Mất kết nối backend" | Chưa build frontend (`npm run build:frontend`), hoặc firewall chặn 3000 |
| `Cannot find module ...` | Chưa `npm install` trên VPS (đừng copy node_modules từ Windows) |
| Mở `http://IP:3000` không lên | Chưa mở firewall / Security Group cổng 3000 |
| MQTT báo lỗi khi khởi động | Không sao — server vẫn chạy. Muốn ẩn: đặt `ENABLE_MQTT=false` |
| Mất dữ liệu sau restart | Kiểm tra quyền ghi thư mục `backend/data/` (chứa file SQLite `twin.db`) |

---

### Tóm tắt siêu gọn
```bash
# trên VPS, trong thư mục backend:
cp .env.example .env
npm run deploy
sudo ufw allow 3000/tcp
# → mở http://<IP_VPS>:3000
```
