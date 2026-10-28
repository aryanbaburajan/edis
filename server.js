import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import QRCode from 'qrcode';

const sessions = new Map();
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/session' && req.method === 'POST') {
    const id = randomBytes(24).toString('base64url');
    sessions.set(id, { browser: null, phone: null });
    res.writeHead(201, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ id }));
  }
  if (url.pathname === '/api/qr') {
    const id = url.searchParams.get('id');
    if (!sessions.has(id)) { res.writeHead(404); return res.end(); }
    const origin = process.env.PUBLIC_ORIGIN || `${req.headers['x-forwarded-proto']?.split(',')[0] || 'http'}://${req.headers.host}`;
    const link = new URL(`/phone.html#${id}`, origin).toString();
    res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' });
    return res.end(await QRCode.toString(link, { type: 'svg', margin: 1 }));
  }
  const files = { '/': ['index.html', 'text/html'], '/phone.html': ['phone.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
  const file = files[url.pathname];
  if (!file) { res.writeHead(404); return res.end('Not found'); }
  try { const data = await readFile(new URL(`./public/${file[0]}`, import.meta.url)); res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8` }); res.end(data); } catch { res.writeHead(500); res.end(); }
});
const wss = new WebSocketServer({ server, maxPayload: 1024 });
const send = (ws, data) => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); };
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const session = sessions.get(url.searchParams.get('id'));
  const role = url.searchParams.get('role');
  if (!session || !['browser', 'phone'].includes(role)) return ws.close(1008, 'Invalid session');
  if (session[role]) session[role].close(1000, 'Replaced');
  session[role] = ws;
  const other = role === 'phone' ? 'browser' : 'phone';
  send(ws, { type: 'status', connected: session[other]?.readyState === WebSocket.OPEN });
  send(session[other], { type: 'status', connected: true });
  ws.on('message', raw => { if (role !== 'phone') return; try { const msg = JSON.parse(raw); if (msg.type === 'impact' && Number.isFinite(msg.magnitude)) send(session.browser, { type: 'impact', magnitude: msg.magnitude }); } catch {} });
  ws.on('close', () => { if (session[role] !== ws) return; session[role] = null; send(session[other], { type: 'status', connected: false }); });
});
// Bound lifetime of unused sessions while allowing temporary reconnects.
setInterval(() => { for (const [id, s] of sessions) { if (!s.browser && !s.phone) { if (!s.emptySince) s.emptySince = Date.now(); else if (Date.now() - s.emptySince > 3600000) sessions.delete(id); } else s.emptySince = null; } }, 60000).unref();
server.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log(`Listening on port ${process.env.PORT || 3000}`));
