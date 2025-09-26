import http from 'node:http';
import { URL } from 'node:url';

const HOST = '127.0.0.1';
const DEFAULT_PORT = Number(process.env.PORT || 17872);
const MAX_RETRIES = 10;

function setSecurityHeaders(res: http.ServerResponse) {
  // Cache off: avoid host/browser caches
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Lock down page
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'none'; frame-ancestors 'none'"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', ''); // deny all features by default
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.statusCode = 400;
    return void res.end('Bad Request');
  }
  const url = new URL(req.url, `http://${HOST}`);

  setSecurityHeaders(res);

  if (req.method === 'GET' && url.pathname === '/healthz') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return void res.end('ok');
  }

  if (req.method === 'GET' && url.pathname === '/') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return void res.end(`<!doctype html>
<meta charset="utf-8">
<title>USB-LLM Launcher</title>
<meta http-equiv="Cache-Control" content="no-store" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
<h1>USB-LLM launcher is running</h1>
<ul>
  <li><code>GET /</code> — this page</li>
  <li><code>GET /healthz</code> — returns <code>ok</code></li>
</ul>
<p>Bound to <code>127.0.0.1</code> only.</p>`);
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Not Found');
});

function listenWithRetry(port: number, retriesLeft: number) {
  server.once('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' && retriesLeft > 0) {
      const next = port + 1;
      console.warn(`[usb-llm] Port ${port} in use, trying ${next}...`);
      server.removeAllListeners('error');
      listenWithRetry(next, retriesLeft - 1);
    } else {
      console.error('[usb-llm] Failed to start server:', err);
      process.exit(1);
    }
  });

  server.listen(port, HOST, () => {
    const addr = server.address();
    const p = typeof addr === 'object' && addr ? addr.port : port;
    console.log(`[usb-llm] Launcher listening at http://${HOST}:${p}`);
  });
}

function shutdown() {
  console.log('\n[usb-llm] Shutting down...');
  server.close(() => {
    console.log('[usb-llm] Closed.');
    process.exit(0);
  });
  // Hard-exit if close hangs
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

listenWithRetry(DEFAULT_PORT, MAX_RETRIES);
