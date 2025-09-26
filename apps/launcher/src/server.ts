import http from 'node:http';
import { URL } from 'node:url';

const HOST = '127.0.0.1';
const DEFAULT_PORT = Number(process.env.PORT || 17872);
const MAX_RETRIES = 10;
const MAX_BODY_BYTES = 1 * 1024 * 1024; // 1MB safety cap

type JsonDict = Record<string, unknown>;

function setSecurityHeaders(res: http.ServerResponse) {
  // Avoid browser/host caching; keep everything ephemeral
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Lock down page / same-origin
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'none'; frame-ancestors 'none'"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', ''); // deny all by default
}

/* ----------------------------- JSON helpers ----------------------------- */

async function readJson<T = JsonDict>(req: http.IncomingMessage): Promise<T> {
  let total = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBuffer);
    total += buf.length;
    if (total > MAX_BODY_BYTES) {
      const err = new Error('Payload too large');
      (err as any).statusCode = 413;
      throw err;
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return (raw ? JSON.parse(raw) : {}) as T;
}

function sendJson(res: http.ServerResponse, body: unknown, status = 200) {
  setSecurityHeaders(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

/* --------------------------- SSE (Server Events) ------------------------ */

function sseStart(res: http.ServerResponse) {
  // Set security + SSE-specific headers
  setSecurityHeaders(res);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Connection: 'keep-alive',
    // 'X-Accel-Buffering': 'no' // useful behind proxies; loopback here
  });
}

function sseEvent(res: http.ServerResponse, event: string, data: unknown) {
  // SSE frame: event + data + blank line
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function sseEnd(res: http.ServerResponse) {
  res.write(`event: done\ndata: {}\n\n`);
  res.end();
}

/* ------------------------------ HTTP server ----------------------------- */

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) {
      res.statusCode = 400;
      return void res.end('Bad Request');
    }
    const url = new URL(req.url, `http://${HOST}`);

    // Health
    if (req.method === 'GET' && url.pathname === '/healthz') {
      setSecurityHeaders(res);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return void res.end('ok');
    }

    // Root
    if (req.method === 'GET' && url.pathname === '/') {
      setSecurityHeaders(res);
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
  <li><code>POST /api/stream</code> — SSE stream (stub)</li>
</ul>
<p>Bound to <code>127.0.0.1</code> only.</p>`);
    }

    // Streaming endpoint (SSE): POST /api/stream
    if (req.method === 'POST' && url.pathname === '/api/stream') {
      // Expect JSON: { prompt: string, max_tokens?: number, delay_ms?: number }
      type StreamReq = { prompt?: string; max_tokens?: number; delay_ms?: number };
      let body: StreamReq;
      try {
        body = await readJson<StreamReq>(req);
      } catch (e) {
        const status = (e as any).statusCode ?? 400;
        return sendJson(res, { error: (e as Error).message ?? 'Invalid JSON' }, status);
      }

      if (!body.prompt || typeof body.prompt !== 'string') {
        return sendJson(res, { error: '`prompt` is required (string)' }, 400);
      }

      // Start SSE
      sseStart(res);
      sseEvent(res, 'meta', {
        model: 'stub-sse',
        started_at: new Date().toISOString(),
      });

      // Very small, deterministic "draft" just for wiring:
      const draft =
        `Hello,\n\nThanks for your note. Here’s a short first draft based on your prompt:\n\n` +
        body.prompt.slice(0, 200) +
        `\n\nBest regards,\nUSB-LLM`;
      const chunks = tokenizeForDemo(draft, body.max_tokens ?? 120);
      const delay = clamp(body.delay_ms ?? 40, 10, 200); // ms per chunk

      // Emit chunks as token events
      let i = 0;
      const tick = setInterval(() => {
        if (i >= chunks.length) {
          clearInterval(tick);
          return sseEnd(res);
        }
        sseEvent(res, 'token', { text: chunks[i++] });
      }, delay);

      // Keepalive ping (prevents some clients from timing out)
      const ping = setInterval(() => sseEvent(res, 'ping', {}), 15000);

      // Cleanup on client disconnect
      req.on('close', () => {
        clearInterval(tick);
        clearInterval(ping);
      });
      return;
    }

    // Fallback
    setSecurityHeaders(res);
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Not Found');
  } catch (err) {
    try {
      setSecurityHeaders(res);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    } catch {}
    console.error('[usb-llm] Unhandled error:', err);
  }
});

function tokenizeForDemo(text: string, maxTokens: number): string[] {
  // naive "token" splitting: words + small punctuation, then cap token count
  const raw = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(\s|[,.;:!?])/)
    .filter(Boolean);
  return raw.slice(0, Math.max(1, maxTokens));
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

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
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

listenWithRetry(DEFAULT_PORT, MAX_RETRIES);
