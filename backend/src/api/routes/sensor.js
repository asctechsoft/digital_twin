'use strict';
const { Router } = require('express');
const db = require('../../db/timeseries');

const router = Router();

// POST /api/v1/sensor/batch — ingest batch sensor readings
router.post('/batch', (req, res) => {
  const { loc, readings } = req.body;
  if (!loc || !Array.isArray(readings) || !readings.length) {
    return res.status(400).json({ success: false, error: 'loc and readings[] required' });
  }
  const written = readings.map(r =>
    db.write('traffic_density', { loc, dir: r.dir },
      { value: parseFloat(r.density), count: r.count || 0 })
  );
  res.status(201).json({ success: true, written: written.length, loc });
});

// GET /api/v1/sensor/:loc/latest
router.get('/:loc/latest', (req, res) => {
  const state = req.engine.getStateVector();
  res.json({
    success: true,
    loc: req.params.loc,
    densities: state.densities,
    sim_hour: state.sim_hour,
    ts: state.ts,
  });
});

module.exports = router;
