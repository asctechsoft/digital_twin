'use strict';
const config = require('../config');

/**
 * Simulates IoT camera/sensor readings for each road direction.
 * Density 0.0 = empty, 1.0 = fully blocked.
 */
class DataGenerator {
  constructor() {
    this.incident = null;  // null | 'accident' | 'emergency' | 'vip'
    this.incidentDir = null;
    this.noise = 0.06;
  }

  // Linear interpolation of hour multiplier from profile table
  getHourMult(hour) {
    const profiles = config.HOUR_PROFILES;
    for (let i = 0; i < profiles.length - 1; i++) {
      if (hour >= profiles[i].hour && hour < profiles[i + 1].hour) {
        const t = (hour - profiles[i].hour) / (profiles[i + 1].hour - profiles[i].hour);
        return profiles[i].mult + t * (profiles[i + 1].mult - profiles[i].mult);
      }
    }
    return profiles[profiles.length - 1].mult;
  }

  rawDensity(dir, hour) {
    const base = config.DIRECTION_BASES[dir] || 0.3;
    const mult = this.getHourMult(hour);
    const noise = (Math.random() - 0.5) * 2 * this.noise;
    return Math.min(1, Math.max(0, base * mult + noise));
  }

  applyIncident(d) {
    if (!this.incident) return d;
    const r = { ...d };
    switch (this.incident) {
      case 'accident':
        // NS blocked — big density spike, NE also affected
        r.NS = Math.min(1, r.NS * 1.7 + 0.30);
        r.NE = Math.min(1, r.NE * 1.30);
        break;
      case 'emergency':
        // All lanes partially clear for emergency vehicle
        Object.keys(r).forEach(k => { r[k] = Math.max(0.05, r[k] * 0.65); });
        break;
      case 'vip':
        // NS cleared for convoy, others unaffected
        r.NS = Math.max(0.02, r.NS * 0.08);
        break;
    }
    return r;
  }

  // Generate one set of readings for a given simulated hour
  generate(simHour) {
    const raw = {};
    for (const dir of ['NS', 'EW', 'NE', 'SW']) {
      raw[dir] = this.rawDensity(dir, simHour);
    }
    return this.applyIncident(raw);
  }

  setIncident(type, dir = null) {
    this.incident = type;
    this.incidentDir = dir;
  }

  clearIncident() {
    this.incident = null;
    this.incidentDir = null;
  }
}

module.exports = new DataGenerator();
