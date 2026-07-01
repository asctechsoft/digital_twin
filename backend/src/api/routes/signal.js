'use strict';
const { Router } = require('express');

const router = Router();

// GET /api/v1/signal/:id/current
router.get('/:id/current', (req, res) => {
  const { engine } = req;
  res.json({
    success: true,
    data: {
      loc:      req.params.id,
      signal:   engine.signal,
      phase:    engine.getPhase(),
      cycleLen: engine.cycleLen,
    },
  });
});

// PUT /api/v1/signal/:id/command  { ns_green, ew_green, src? }
router.put('/:id/command', (req, res) => {
  const { ns_green, ew_green, src } = req.body;
  if (!ns_green || !ew_green) {
    return res.status(400).json({ success: false, error: 'ns_green and ew_green required' });
  }
  req.engine.applySignal(parseInt(ns_green), parseInt(ew_green), src || 'REST');
  res.status(204).send();
});

module.exports = router;
