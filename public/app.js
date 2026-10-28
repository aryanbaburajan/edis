const phone = location.pathname === '/phone.html';
const status = document.querySelector('#status');
const notice = document.querySelector('#notice');
let socket;
function connect(id) {
  socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/?id=${encodeURIComponent(id)}&role=${phone ? 'phone' : 'browser'}`);
  socket.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.type === 'status') status.textContent = msg.connected ? (phone ? 'Browser connected' : 'Phone connected') : (phone ? 'Waiting for browser…' : 'Waiting for phone…');
    if (msg.type === 'impact' && !phone) {
      const text = `Impact detected · ${msg.magnitude.toFixed(1)} m/s²`;
      const alert = document.querySelector('#alert'); alert.hidden = false; alert.textContent = `${text} at ${new Date().toLocaleTimeString()}`;
      if ('Notification' in window && Notification.permission === 'granted') new Notification('Phone impact detected', { body: text });
    }
  };
  socket.onclose = event => { status.textContent = event.code === 1008 ? 'Session expired. Open a new pairing link.' : 'Disconnected. Reconnecting…'; if (event.code !== 1008 && event.reason !== 'Replaced') setTimeout(() => connect(id), 1500); };
}
if (phone) {
  const id = location.hash.slice(1);
  if (id) connect(id); else status.textContent = 'Invalid pairing link.';
  let lastImpact = 0, lastDisplay = 0, received = false;
  document.querySelector('#start').onclick = async () => {
    if (!window.isSecureContext) { notice.textContent = 'Motion access requires HTTPS.'; return; }
    if (!('DeviceMotionEvent' in window)) { notice.textContent = 'Motion sensing is unavailable in this browser.'; return; }
    try {
      if (typeof DeviceMotionEvent.requestPermission === 'function' && await DeviceMotionEvent.requestPermission() !== 'granted') { notice.textContent = 'Motion permission denied. Enable it in your browser settings.'; return; }
      window.addEventListener('devicemotion', event => {
        const a = event.accelerationIncludingGravity;
        if (!a || ![a.x, a.y, a.z].every(Number.isFinite)) return;
        received = true;
        const magnitude = Math.hypot(a.x, a.y, a.z), now = Date.now();
        if (now - lastDisplay > 200) { document.querySelector('#reading').innerHTML = `${magnitude.toFixed(1)} <span>m/s²</span>`; lastDisplay = now; }
        if (magnitude >= 30 && now - lastImpact >= 5000 && socket?.readyState === WebSocket.OPEN) { socket.send(JSON.stringify({ type: 'impact', magnitude })); lastImpact = now; notice.textContent = 'Impact sent to browser.'; }
      });
      document.querySelector('#start').disabled = true; notice.textContent = 'Motion sensor enabled. Keep this page open.';
      setTimeout(() => { if (!received) notice.textContent = 'No motion readings received. Check sensor permissions and browser support.'; }, 5000);
      if ('wakeLock' in navigator) navigator.wakeLock.request('screen').catch(() => {});
    } catch { notice.textContent = 'Could not enable motion access. Check browser permissions.'; }
  };
} else {
  document.querySelector('#notifications').onclick = async () => { if (!('Notification' in window)) { notice.textContent = 'Desktop notifications are unavailable in this browser.'; return; } const result = await Notification.requestPermission(); notice.textContent = result === 'granted' ? 'Desktop notifications enabled.' : 'Desktop notifications are not enabled; page alerts still work.'; };
  try { const response = await fetch('/api/session', { method: 'POST' }); if (!response.ok) throw Error(); const { id } = await response.json(); document.querySelector('#qr').src = `/api/qr?id=${encodeURIComponent(id)}`; connect(id); } catch { status.textContent = 'Could not create a session. Reload to try again.'; }
}
