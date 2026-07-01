'use strict';
const { Router } = require('express');
const db = require('../../db/timeseries');

const router = Router();

// GET /api/v1/intersection/:id/state
router.get('/:id/state', (req, res) => {
  res.json({ success: true, data: req.engine.getStateVector() });
});

// GET /api/v1/intersection/:id/history?dir=NS&n=30
router.get('/:id/history', (req, res) => {
  const dir = (req.query.dir || 'NS').toUpperCase();
  const n   = Math.min(200, parseInt(req.query.n || '30'));
  const pts = db.queryLast('traffic_density', { loc: req.params.id, dir }, n);
  res.json({
    success: true,
    loc: req.params.id,
    dir,
    data: pts.map(p => ({ ts: p.ts, value: p.fields.value, count: p.fields.count })),
  });
});

module.exports = router;
