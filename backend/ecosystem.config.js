// Cấu hình PM2 để chạy backend nền trên VPS, tự khởi động lại khi crash/reboot.
//   pm2 start ecosystem.config.js
//   pm2 logs digital-twin       # xem log
//   pm2 save && pm2 startup     # tự chạy lại sau khi VPS reboot
module.exports = {
  apps: [
    {
      name: 'digital-twin',
      script: 'server.js',
      cwd: __dirname,            // luôn chạy từ thư mục backend (để DB_PATH đúng)
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      watch: false,
      env: {
        NODE_ENV: 'production',
        // Có thể ghi đè cấu hình ở đây thay cho file .env:
        // PORT: 3000,
        // ENABLE_MQTT: 'false',
      },
    },
  ],
};
