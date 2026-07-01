'use strict';
const { Router } = require('express');
const { runWhatIf } = require('../../ai/whatif');

const router = Router();

// GET /api/v1/ai/scenarios  — run fresh what-if now
router.get('/scenarios', (req, res) => {
  const result = runWhatIf(req.engine.densities, req.engine.signal);
  res.json({ success: true, data: result });
});

// GET /api/v1/ai/recommendation  — last cached result
router.get('/recommendation', (req, res) => {
  if (!req.engine.lastAI) {
    return res.status(503).json({ success: false, error: 'AI not computed yet — wait a few seconds' });
  }
  res.json({ success: true, data: req.engine.lastAI });
});

module.exports = router;
