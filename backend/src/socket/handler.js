'use strict';
const { runWhatIf } = require('../ai/whatif');

function registerSocketHandlers(socket, engine) {
  // Send full snapshot immediately on connect
  socket.emit('state_update', engine.getStateVector());
  if (engine.lastAI) socket.emit('ai_recommendation', engine.lastAI);

  // ── Control events ────────────────────────────────────────────────────────

  socket.on('apply_signal', ({ ns_green, ew_green, src }) => {
    if (!ns_green || !ew_green) return;
    engine.applySignal(parseInt(ns_green), parseInt(ew_green), src || 'Socket');
  });

  socket.on('trigger_incident', ({ type, dir }) => {
    engine.triggerIncident(type, dir || null);
  });

  socket.on('clear_incident', () => {
    engine.clearIncident();
  });

  socket.on('set_speed', ({ multiplier }) => {
    engine.setSpeed(Number(multiplier));
    socket.emit('speed_changed', { multiplier: engine.speedMultiplier });
  });

  socket.on('set_hour', ({ hour }) => {
    engine.setSimHour(Number(hour));
    socket.emit('hour_changed', { hour: engine.simHour });
  });

  // ── On-demand queries ─────────────────────────────────────────────────────

  socket.on('get_state', () => {
    socket.emit('state_update', engine.getStateVector());
  });

  socket.on('get_ai_scenarios', () => {
    const result = runWhatIf(engine.densities, engine.signal);
    socket.emit('ai_recommendation', result);
  });
}

module.exports = { registerSocketHandlers };
