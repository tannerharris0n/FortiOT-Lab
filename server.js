const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Connected browser clients
const clients = new Set();
wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const c of clients) {
    if (c.readyState === 1) c.send(data);
  }
}

// FortiGate automation stitch webhook receiver
// Configure stitch action URL as: http://<your-laptop-ip>:3000/webhook
app.post('/webhook', (req, res) => {
  const body = req.body || {};
  console.log('[WEBHOOK]', new Date().toISOString(), JSON.stringify(body));

  // FortiGate DIO event - detect E-Stop trigger
  // The stitch body will include event info; we key off common fields
  const msg = (body.msg || body.message || body.description || '').toLowerCase();
  const logdesc = (body.logdesc || '').toLowerCase();
  const state = (body.state || body.input_state || '').toLowerCase();

  let scene = null;

  // E-Stop: IN1_REF goes open (button pressed - NC circuit broken)
  if (state === 'open' || msg.includes('open') || msg.includes('estop') || msg.includes('e-stop')) {
    scene = 'estop';
  }
  // Reset: IN1_REF goes closed (button released/twisted)
  else if (state === 'close' || state === 'closed' || msg.includes('close')) {
    scene = 'normal';
  }
  // IPS alert
  else if (msg.includes('ips') || msg.includes('intrusion') || logdesc.includes('ips')) {
    scene = 'ips';
  }
  // Policy block
  else if (msg.includes('deny') || msg.includes('block') || msg.includes('drop')) {
    scene = 'block';
  }
  // Generic - pass scene directly if FortiGate stitch sends it
  else if (body.scene) {
    scene = body.scene;
  }

  if (scene) {
    broadcast({ type: 'scene', scene });
    console.log(`[WEBHOOK] --> broadcasting scene: ${scene}`);
  } else {
    broadcast({ type: 'raw', data: body });
    console.log('[WEBHOOK] --> broadcasting raw event');
  }

  res.json({ ok: true, scene });
});

// WLED proxy - avoids CORS, keeps WLED IP server-side
app.post('/wled', async (req, res) => {
  const { ip, payload } = req.body;
  if (!ip || !payload) return res.status(400).json({ error: 'missing ip or payload' });

  const url = `http://${ip}/json/state`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });
    const data = await r.json().catch(() => ({}));
    console.log(`[WLED] POST ${url} --> ${r.status}`);
    res.json({ ok: r.ok, status: r.status, data });
  } catch (e) {
    console.error(`[WLED] Error reaching ${url}:`, e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ ok: true, clients: clients.size }));

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const ifaces = os.networkInterfaces();
  let lan = 'your-laptop-ip';
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) { lan = iface.address; break; }
    }
  }
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║       FORTINET OT DEMO CONTROLLER - SERVER           ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  App:           http://localhost:${PORT}                  ║`);
  console.log(`║  LAN (browser): http://${lan}:${PORT}                ║`);
  console.log(`║  FortiGate stitch webhook:                           ║`);
  console.log(`║    http://${lan}:${PORT}/webhook               ║`);
  console.log(`║  WLED proxy:    http://localhost:${PORT}/wled              ║`);
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
});
