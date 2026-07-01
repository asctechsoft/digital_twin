'use strict';
const { Router } = require('express');

const intersectionRoutes = require('./routes/intersection');
const sensorRoutes       = require('./routes/sensor');
const aiRoutes           = require('./routes/ai');
const signalRoutes       = require('./routes/signal');
const incidentRoutes     = require('./routes/incident');
const validationRoutes   = require('./routes/validation');

function createApiRouter(engine) {
  const router = Router();

  // Inject engine into every request
  router.use((req, _res, next) => { req.engine = engine; next(); });

  router.use('/intersection', intersectionRoutes);
  router.use('/sensor',       sensorRoutes);
  router.use('/ai',           aiRoutes);
  router.use('/signal',       signalRoutes);
  router.use('/incident',     incidentRoutes);
  router.use('/validation',   validationRoutes);

  router.get('/health', (_req, res) => {
    res.json({ ok: true, uptime: Math.round(process.uptime()), ts: Date.now() });
  });

  return router;
}

module.exports = createApiRouter;
