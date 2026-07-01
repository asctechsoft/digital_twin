'use strict';
const { Router } = require('express');

const VALID = ['accident', 'emergency', 'vip'];
const router = Router();

// POST /api/v1/incident  { type, dir? }
router.post('/', (req, res) => {
  const { type, dir } = req.body;
  if (!VALID.includes(type)) {
    return res.status(400).json({ success: false, error: `type must be: ${VALID.join(' | ')}` });
  }
  req.engine.triggerIncident(type, dir || null);
  res.status(201).json({ success: true, incident: { type, dir: dir || null, active: true } });
});

// DELETE /api/v1/incident/:loc
router.delete('/:loc', (req, res) => {
  req.engine.clearIncident();
  res.status(204).send();
});

// GET /api/v1/incident/status
router.get('/status', (req, res) => {
  res.json({ success: true, incident: req.engine.incident });
});

module.exports = router;
