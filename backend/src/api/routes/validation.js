'use strict';
const { Router } = require('express');
const { runValidation } = require('../../ai/validation');
const db = require('../../db/timeseries');

const router = Router();

// GET /api/v1/validation/rmse?cycles=1000
// Chạy N chu kỳ, so sánh dự báo vs thực tế → RMSE / MAE (tổng + theo hướng)
router.get('/rmse', (req, res) => {
  const cycles = parseInt(req.query.cycles || '1000');
  const result = runValidation(cycles);
  res.json({ success: true, data: result });
});

// GET /api/v1/validation/history?n=20 — các lần kiểm định đã lưu
router.get('/history', (req, res) => {
  const n = Math.min(200, parseInt(req.query.n || '20'));
  const pts = db.queryLast('validation', { loc: 'hk01' }, n);
  res.json({
    success: true,
    data: pts.map(p => ({ ts: p.ts, ...p.fields })),
  });
});

module.exports = router;
