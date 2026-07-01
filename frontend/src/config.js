// ─────────────────────────────────────────────────────────────────────────────
// Cấu hình kết nối backend.
//
//  • BACKEND_URL = 'http://localhost:3000'  → gọi thẳng (backend đã bật CORS).
//  • BACKEND_URL = ''                        → đi qua proxy của Vite (xem vite.config.js),
//                                              hữu ích khi deploy chung domain.
//
// Có thể override bằng biến môi trường khi chạy:  VITE_BACKEND_URL=http://192.168.1.10:3000 npm run dev
// ─────────────────────────────────────────────────────────────────────────────
// Mặc định '' = same-origin: frontend gọi thẳng host đang phục vụ nó.
//   • Khi backend phục vụ frontend (deploy 1 port trên VPS)  → tự nối đúng IP VPS.
//   • Khi chạy dev `npm run dev` (port 5173)                  → đi qua proxy Vite sang :3000.
// Muốn trỏ tới backend ở máy/khác cổng: đặt VITE_BACKEND_URL=http://<IP>:3000 khi build/dev.
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? '';

// Base cho REST API. Nếu BACKEND_URL rỗng → dùng đường dẫn tương đối (qua proxy).
export const API_BASE = (BACKEND_URL || '') + '/api/v1';

// ID nút giao của backend (xem backend/src/config.js → INTERSECTIONS)
export const INTERSECTION_ID = 'hk01';
