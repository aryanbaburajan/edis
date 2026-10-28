# Impact Pair

A minimal phone impact alert prototype. Install with `npm install` and run `npm start`. Open the app in a desktop browser, scan its QR code, and enable motion access on the phone. Keep both pages open. Enable desktop notifications on the browser if desired.

Deploy the Node.js app to a host supporting long-lived WebSockets and HTTPS, setting `PORT` as required by the host. Set `PUBLIC_ORIGIN` to the public HTTPS origin (for example `https://example.com`) so the QR link works behind a proxy. HTTPS is required for phone motion sensors and desktop notifications. Sessions are held in memory and disappear on restart; use one server instance. The 30 m/s² threshold is a crude impact heuristic, not reliable fall detection. Backgrounded or locked phone pages can stop receiving motion events.
