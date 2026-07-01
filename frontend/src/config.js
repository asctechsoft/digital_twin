// ─────────────────────────────────────────────────────────────────────────────
// Cấu hình kết nối backend.
//
//  • BACKEND_URL = 'http://localhost:3000'  → gọi thẳng (backend đã bật CORS).
//  • BACKEND_URL = ''                        → đi qua proxy của Vite (xem vite.config.js),
//                                              hữu ích khi deploy chung domain.
//
// Có thể override bằng biến môi trường khi chạy:  VITE_BACKEND_URL=http://192.168.1.10:3000 npm run dev
// ─────────────────────────────────────────────────────────────────────────────
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000';

// Base cho REST API. Nếu BACKEND_URL rỗng → dùng đường dẫn tương đối (qua proxy).
export const API_BASE = (BACKEND_URL || '') + '/api/v1';

// ID nút giao của backend (xem backend/src/config.js → INTERSECTIONS)
export const INTERSECTION_ID = 'hk01';
