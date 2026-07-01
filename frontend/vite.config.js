import { defineConfig } from 'vite';

// Frontend dev server chạy ở cổng 5173, backend ở cổng 3000.
// Backend đã bật CORS (`origin: '*'`) nên gọi thẳng http://localhost:3000 được.
// Nếu muốn tránh CORS hoàn toàn, có thể dùng proxy bên dưới + để VITE_BACKEND_URL=''.
export default defineConfig({
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Bật proxy nếu đặt BACKEND_URL = '' trong src/config.js
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3000', ws: true, changeOrigin: true },
    },
  },
});
