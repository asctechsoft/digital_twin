'use strict';
const config = require('../config');
const db = require('../db/timeseries');
const generator = require('../simulator/generator');
const { runWhatIf } = require('../ai/whatif');

const DIRS = ['NS', 'EW', 'NE', 'SW'];

class TwinEngine {
  constructor(io) {
    this.io = io;
    this.running = false;
    this._timer = null;
    this.tickCount = 0;
    this.speedMultiplier = 1;

    // Simulated clock — starts at current real hour
    this.simHour = new Date().getHours();
    this._hourFrac = 0;

    // Signal timing
    this.signal = { nsGreen: 55, ewGreen: 35 };
    this.cycleLen = this._computeCycle();
    this.phaseTick = 0;

    // State
    this.densities = { NS: 0.30, EW: 0.25, NE: 0.20, SW: 0.18 };
    this.history = { NS: [], EW: [], NE: [], SW: [] };
    this.incident = null;
    this.lastAI = null;

    // KPIs (cumulative)
    this.kpis = { throughput: 0, avgWait: 0, efficiency: 0, optimizations: 0 };

    // MQTT publish client (attached after broker starts)
    this.mqttClient = null;
  }

  _computeCycle() {
    return this.signal.nsGreen + this.signal.ewGreen + config.YELLOW_DURATION * 2;
  }

  // Determine current signal phase and countdown
  getPhase() {
    const { nsGreen, ewGreen } = this.signal;
    const y = config.YELLOW_DURATION;
    const t = this.phaseTick % this.cycleLen;

    if (t < nsGreen)
      return { phase: 'NS_GREEN',  ns: 'green',  ew: 'red',    countdown: nsGreen - t };
    if (t < nsGreen + y)
      return { phase: 'NS_YELLOW', ns: 'yellow', ew: 'red',    countdown: nsGreen + y - t };
    if (t < nsGreen + y + ewGreen)
      return { phase: 'EW_GREEN',  ns: 'red',    ew: 'green',  countdown: nsGreen + y + ewGreen - t };
    return   { phase: 'EW_YELLOW', ns: 'red',    ew: 'yellow', countdown: this.cycleLen - t };
  }

  _tick() {
    this.tickCount++;
    this.phaseTick = (this.phaseTick + 1) % this.cycleLen;

    // Advance simulated hour (1 real second = 1/3600 simulated hour × speed)
    this._hourFrac += this.speedMultiplier / 3600;
    if (this._hourFrac >= 1) {
      this.simHour = (this.simHour + 1) % 24;
      this._hourFrac = 0;
    }

    // Generate fresh sensor readings from simulator
    const readings = generator.generate(this.simHour);

    // Feedback: active green phase reduces that direction's density slightly
    const phase = this.getPhase();
    if (phase.ns === 'green') readings.NS = Math.max(0, readings.NS - 0.04);
    if (phase.ew === 'green') readings.EW = Math.max(0, readings.EW - 0.04);

    // Round to 4 dp
    DIRS.forEach(d => { readings[d] = parseFloat(readings[d].toFixed(4)); });
    this.densities = readings;

    // Update rolling history
    DIRS.forEach(dir => {
      this.history[dir].push(readings[dir]);
      if (this.history[dir].length > config.HISTORY_WINDOW) this.history[dir].shift();
    });

    // Update KPIs
    const avg = DIRS.reduce((s, d) => s + readings[d], 0) / 4;
    this.kpis.throughput = Math.round(220 * (1 - avg));
    this.kpis.avgWait    = Math.round(avg * 85);
    this.kpis.efficiency = Math.round((1 - avg) * 100);

    // Persist to in-memory time-series DB and emit DB log
    DIRS.forEach(dir => {
      const tags   = { loc: 'hk01', dir };
      const fields = { value: readings[dir], count: Math.round(readings[dir] * 200) };
      const lp     = db.toLineProtocol('traffic_density', tags, fields);
      db.write('traffic_density', tags, fields);
      this.io.emit('db_log', { ts: Date.now(), lp, measurement: 'traffic_density', tags, fields });
    });
    db.write('signal_state', { loc: 'hk01' }, {
      ns_green: this.signal.nsGreen, ew_green: this.signal.ewGreen,
      phase: phase.phase, countdown: phase.countdown,
    });
    db.write('kpi', { loc: 'hk01' }, { ...this.kpis });

    // Publish sensor data via MQTT (each direction on its own topic)
    if (this.mqttClient && this.mqttClient.connected) {
      DIRS.forEach(dir => {
        const payload = JSON.stringify({ d: readings[dir], cnt: Math.round(readings[dir] * 200), ts: Date.now() });
        this.mqttClient.publish(`traffic/hn/hk01/sensor/${dir}`, payload, { qos: 0 });
      });
    }

    // Emit full state to all socket clients
    this.io.emit('state_update', this.getStateVector());

    // Run AI every N ticks
    if (this.tickCount % config.AI_INTERVAL_TICKS === 0) {
      this.lastAI = runWhatIf(this.densities, this.signal);
      this.io.emit('ai_recommendation', this.lastAI);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    const ms = Math.round(1000 / this.speedMultiplier);
    this._timer = setInterval(() => this._tick(), ms);
    console.log(`[ENGINE] Started — tick every ${ms}ms, simHour=${this.simHour}`);
  }

  stop() {
    clearInterval(this._timer);
    this._timer = null;
    this.running = false;
  }

  setSpeed(mult) {
    this.speedMultiplier = Math.max(0.5, Math.min(10, mult));
    if (this.running) { this.stop(); this.start(); }
  }

  setSimHour(h) {
    this.simHour = Math.max(0, Math.min(23, Math.floor(h)));
    this._hourFrac = 0;
    console.log(`[ENGINE] simHour set to ${this.simHour}`);
  }

  applySignal(nsGreen, ewGreen, src = 'API') {
    const prev = { ...this.signal };
    this.signal.nsGreen = Math.max(10, Math.min(80, nsGreen));
    this.signal.ewGreen = Math.max(10, Math.min(80, ewGreen));
    this.cycleLen = this._computeCycle();
    this.kpis.optimizations++;

    const ev = { ts: Date.now(), src, prev, next: { ...this.signal } };
    this.io.emit('signal_changed', ev);
    console.log(`[ENGINE] Signal applied by ${src}: NS=${this.signal.nsGreen}s EW=${this.signal.ewGreen}s`);

    // Publish command on MQTT so physical controller would receive it
    if (this.mqttClient && this.mqttClient.connected) {
      this.mqttClient.publish(
        'traffic/hn/hk01/signal/command',
        JSON.stringify({ ns_green: this.signal.nsGreen, ew_green: this.signal.ewGreen, src: 'dt-engine', ts: Date.now() }),
        { qos: 1 }
      );
    }
    return ev;
  }

  triggerIncident(type, dir = null) {
    this.incident = { type, dir, ts: Date.now() };
    generator.setIncident(type, dir);
    const ev = { ts: Date.now(), type, dir, active: true };
    this.io.emit('incident_changed', ev);
    if (this.mqttClient && this.mqttClient.connected) {
      this.mqttClient.publish('traffic/hn/hk01/incident/alert',
        JSON.stringify(ev), { qos: 1 });
    }
    console.log(`[ENGINE] Incident triggered: ${type} dir=${dir}`);
  }

  clearIncident() {
    this.incident = null;
    generator.clearIncident();
    const ev = { ts: Date.now(), type: null, active: false };
    this.io.emit('incident_changed', ev);
    if (this.mqttClient && this.mqttClient.connected) {
      this.mqttClient.publish('traffic/hn/hk01/incident/alert',
        JSON.stringify(ev), { qos: 1 });
    }
  }

  // Full state snapshot — this is x(t) the State Vector
  getStateVector() {
    const phase = this.getPhase();
    return {
      ts:       Date.now(),
      loc:      'hk01',
      sim_hour: this.simHour,
      tick:     this.tickCount,
      densities: { ...this.densities },
      history:   { NS: [...this.history.NS], EW: [...this.history.EW],
                   NE: [...this.history.NE], SW: [...this.history.SW] },
      signal: {
        nsGreen: this.signal.nsGreen,
        ewGreen: this.signal.ewGreen,
        yellow:  config.YELLOW_DURATION,
        cycleLen: this.cycleLen,
        phase:   phase.phase,
        ns:      phase.ns,
        ew:      phase.ew,
        countdown: phase.countdown,
        phaseTick: this.phaseTick,
      },
      incident: this.incident,
      kpis:     { ...this.kpis },
      db:       db.stats(),
    };
  }
}

module.exports = TwinEngine;
