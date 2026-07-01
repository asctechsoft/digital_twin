'use strict';
const aedes    = require('aedes');
const net      = require('net');
const ws       = require('ws');
const http     = require('http');
const mqtt     = require('mqtt');
const config   = require('../config');

async function startBroker(io, engine) {
  // ── In-process MQTT broker ────────────────────────────────────────────────
  const broker = aedes();

  // Forward every publish to socket clients (skip internal $ topics)
  broker.on('publish', (packet, client) => {
    if (packet.topic.startsWith('$SYS')) return;
    const raw = packet.payload.toString();
    io.emit('mqtt_log', {
      ts:       Date.now(),
      type:     'PUB',
      clientId: client ? client.id : 'broker',
      topic:    packet.topic,
      payload:  raw.length > 200 ? raw.slice(0, 200) + '…' : raw,
      qos:      packet.qos,
    });
  });

  broker.on('subscribe', (subs, client) => {
    console.log(`[MQTT] ${client?.id} subscribed: ${subs.map(s => s.topic).join(', ')}`);
  });

  broker.on('clientConnected',    c => console.log(`[MQTT] + ${c.id}`));
  broker.on('clientDisconnected', c => console.log(`[MQTT] - ${c.id}`));
  broker.on('error', err => console.error('[MQTT Broker]', err.message));

  // ── TCP transport — port 1883 ─────────────────────────────────────────────
  const tcpServer = net.createServer(broker.handle);
  await new Promise((res, rej) => {
    tcpServer.listen(config.MQTT_TCP_PORT, res);
    tcpServer.on('error', rej);
  });
  console.log(`[MQTT] TCP  → mqtt://localhost:${config.MQTT_TCP_PORT}`);

  // ── WebSocket transport — port 8883 ───────────────────────────────────────
  const wsHttp   = http.createServer();
  const wss      = new ws.WebSocketServer({ server: wsHttp });
  wss.on('connection', socket => {
    const stream = ws.createWebSocketStream(socket);
    broker.handle(stream);
  });
  await new Promise((res, rej) => {
    wsHttp.listen(config.MQTT_WS_PORT, res);
    wsHttp.on('error', rej);
  });
  console.log(`[MQTT] WS   → ws://localhost:${config.MQTT_WS_PORT}`);

  // ── Internal engine MQTT client ───────────────────────────────────────────
  const client = mqtt.connect(`mqtt://localhost:${config.MQTT_TCP_PORT}`, {
    clientId: 'dt-engine',
    clean: true,
    reconnectPeriod: 3000,
  });

  client.on('connect', () => {
    console.log('[MQTT] Engine client connected');
    client.subscribe([
      'traffic/hn/hk01/signal/command',
      'traffic/hn/hk01/incident/#',
    ], { qos: 1 });
    engine.mqttClient = client; // engine can now publish
  });

  // Handle inbound commands (e.g. from external MQTT client connecting to port 1883)
  client.on('message', (topic, payload) => {
    try {
      const msg = JSON.parse(payload.toString());
      if (topic === 'traffic/hn/hk01/signal/command' && msg.src !== 'dt-engine') {
        engine.applySignal(msg.ns_green, msg.ew_green, msg.src || 'MQTT_EXT');
      }
    } catch (_) { /* ignore malformed */ }
  });

  client.on('error', err => console.error('[MQTT Client]', err.message));

  return { broker, tcpServer, wsHttp, client };
}

module.exports = { startBroker };
