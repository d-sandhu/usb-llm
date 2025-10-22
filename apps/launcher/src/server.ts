// apps/launcher/src/server.ts
import http from 'node:http';
import { URL } from 'node:url';
import { loadConfig } from './config.js';
import { streamChat } from './upstream.js';
import { ensureStarted, currentUrl, stop as stopLlama } from './llamaProc.js';
import { resolveLocalModel } from './models.js';
import { buildEmailPrompts, type Flow, type Tone, type Length } from './prompt.js';

const HOST = '127.0.0.1';
const DEFAULT_PORT = Number(process.env.PORT || 17872);
const MAX_RETRIES = 10;
const MAX_BODY_BYTES = 1 * 1024 * 1024;

type JsonDict = Record<string, unknown>;
type HttpError = Error & { statusCode?: number };

function setSecurityHeaders(res: http.ServerResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'none'; frame-ancestors 'none'"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', '');

  // CORS for dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function readJson<T = JsonDict>(req: http.IncomingMessage): Promise<T> {
  let total = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk)
      ? chunk
      : typeof chunk === 'string'
        ? Buffer.from(chunk, 'utf8')
        : Buffer.from(chunk as Uint8Array);
    total += buf.length;
    if (total > MAX_BODY_BYTES) {
      const err: HttpError = new Error('Payload too large');
      err.statusCode = 413;
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

/* --------------------------- SSE helpers (single implementation) ------------------------ */
function sseStart(res: http.ServerResponse) {
  setSecurityHeaders(res);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Connection: 'keep-alive',
  });
}
function sseEvent(res: http.ServerResponse, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}
function sseEnd(res: http.ServerResponse) {
  res.write(`event: done\ndata: {}\n\n`);
  res.end();
}

/* ------------------------------ HTTP server ----------------------------- */

const cfg = loadConfig();

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) {
      res.statusCode = 400;
      return void res.end('Bad Request');
    }
    const url = new URL(req.url, `http://${HOST}`);

    // CORS preflight
    if (req.method === 'OPTIONS') {
      setSecurityHeaders(res);
      res.statusCode = 204;
      return void res.end();
    }

    // health (safe: defaults to stub if no model/upstream)
    if (req.method === 'GET' && url.pathname === '/healthz') {
      setSecurityHeaders(res);

      const submode = cfg.upstreamUrl
        ? 'external'
        : cfg.autostart && cfg.binPath && (cfg.modelFile || cfg.modelId)
          ? currentUrl()
            ? 'local-ready'
            : 'local-idle'
          : null;
      const mode = submode ? 'upstream' : 'stub';

      const resolved = await resolveLocalModel(cfg);
      const runtime = {
        source: cfg.upstreamUrl ? 'upstream' : resolved.status === 'ok' ? 'local' : 'none',
        selectedModelId: resolved.id ?? null,
      };

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return void res.end(JSON.stringify({ ok: true, mode, submode, runtime }));
    }

    // models (read-only selected; safe even if no registry or file)
    if (req.method === 'GET' && url.pathname === '/v1/models') {
      setSecurityHeaders(res);
      const resolved = await resolveLocalModel(cfg);

      const selected =
        resolved.status === 'ok' || resolved.status === 'missing'
          ? {
              id: resolved.id ?? null,
              name: resolved.name ?? null,
              basename: resolved.basename ?? null, // never absolute
              license: resolved.license ?? null,
              ctx: resolved.ctx ?? null,
              quant: resolved.quant ?? null,
              status: resolved.status,
            }
          : { status: 'none' as const };

      const ui = { allowSelection: cfg.uiAllowPicker === true };

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return void res.end(JSON.stringify({ selected, ui }));
    }

    // home
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
  <li><code>GET /healthz</code> — JSON health (mode/submode/runtime)</li>
  <li><code>GET /v1/models</code> — read-only selected model (no picker)</li>
  <li><code>POST /api/stream</code> — SSE stream</li>
</ul>
<p>Bound to <code>127.0.0.1</code> only.</p>`);
    }

    // streaming (always safe → falls back to stub unless upstream is configured)
    if (req.method === 'POST' && url.pathname === '/api/stream') {
      type StreamReq = {
        prompt?: string;
        max_tokens?: number;
        delay_ms?: number;
        flow?: string;
        tone?: string;
        length?: string;
        subject?: string | null;
        context?: string | null;
        instructions?: string | null;
      } & Record<string, unknown>;
      let body: StreamReq;
      try {
        body = await readJson<StreamReq>(req);
      } catch (e) {
        const status = (e as HttpError).statusCode ?? 400;
        return sendJson(res, { error: (e as Error).message ?? 'Invalid JSON' }, status);
      }

      // Prefer structured → build system+user; else legacy `prompt` string.
      const legacyPrompt =
        typeof body.prompt === 'string' && body.prompt.trim().length > 0 ? body.prompt : null;

      const structured = toStructuredArgs(body);
      const built = structured ? buildEmailPrompts(structured) : null;
      const systemOverride =
        built && cfg.systemPrelude
          ? `${cfg.systemPrelude}\n\n${built.system}`
          : built
            ? built.system
            : undefined;
      const userContent = built ? built.user : legacyPrompt;

      if (!userContent) {
        return sendJson(
          res,
          { error: 'Provide `prompt` string or structured fields {flow,tone,length,...}.' },
          400
        );
      }

      sseStart(res);

      // 1) Upstream: proxy stream
      if (cfg.upstreamUrl) {
        sseEvent(res, 'meta', {
          source: 'llama-server',
          url: cfg.upstreamUrl,
          model: cfg.model,
          started_at: new Date().toISOString(),
        });
        try {
          for await (const ev of streamChat(cfg, userContent, systemOverride)) {
            if (ev.type === 'delta') sseEvent(res, 'token', { text: ev.text });
            else if (ev.type === 'meta') sseEvent(res, 'upstream', ev.raw);
            else if (ev.type === 'done') {
              sseEnd(res);
              break;
            }
          }
        } catch (err) {
          sseEvent(res, 'error', { message: (err as Error).message });
          sseEnd(res);
        }
        return;
      }

      // 2) Autostart: prefer explicit file, else headless resolved model
      if (cfg.autostart && cfg.binPath && (cfg.modelFile || cfg.modelId)) {
        const resolved = await resolveLocalModel(cfg);
        const modelPath = cfg.modelFile ?? resolved.absPath ?? null;

        if (!modelPath) {
          // Inform the client and fall back to stub (safe-by-default)
          sseEvent(res, 'error', {
            message:
              'Local model not found (USBLLM_MODEL_FILE missing and no resolved model by USBLLM_MODEL_ID). Falling back to stub.',
          });
          return streamStub(res, req, userContent, body.max_tokens, body.delay_ms);
        }

        sseEvent(res, 'meta', { source: 'supervisor', status: 'starting' });
        try {
          const startedUrl = await ensureStarted({
            binPath: cfg.binPath,
            modelFile: modelPath,
            preferPort: cfg.preferPort,
            ctxSize: cfg.ctxSize ?? undefined,
            threads: cfg.threads ?? undefined,
            tempDir: cfg.tempDir ?? undefined,
            logDisable: cfg.logDisable ?? undefined,
          });
          sseEvent(res, 'meta', { source: 'supervisor', status: 'ready', url: startedUrl });

          const localCfg = { ...cfg, upstreamUrl: startedUrl };
          try {
            for await (const ev of streamChat(localCfg, userContent, systemOverride)) {
              if (ev.type === 'delta') sseEvent(res, 'token', { text: ev.text });
              else if (ev.type === 'meta') sseEvent(res, 'upstream', ev.raw);
              else if (ev.type === 'done') {
                sseEnd(res);
                break;
              }
            }
          } catch (err) {
            sseEvent(res, 'error', {
              message: (err as Error).message || 'Failed during local upstream stream',
            });
            sseEnd(res);
          }
        } catch (err) {
          sseEvent(res, 'error', {
            message: (err as Error).message || 'Failed to start local model',
          });
          sseEnd(res);
        }
        return;
      }

      // 3) Stub fallback (default when no model is present)
      return streamStub(res, req, userContent, body.max_tokens, body.delay_ms);
    }

    // fallback 404
    setSecurityHeaders(res);
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Not Found');
  } catch (err) {
    setSecurityHeaders(res);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    } catch (writeErr) {
      console.error('[usb-llm] Failed to write error response:', writeErr);
    }
    console.error('[usb-llm] Unhandled error:', err);
  }
});

function toStructuredArgs(body: Record<string, unknown>): {
  flow: Flow;
  tone: Tone;
  length: Length;
  subject?: string | null;
  context?: string | null;
  instructions?: string | null;
} | null {
  const f = normStr(body.flow);
  const t = normStr(body.tone);
  const l = normStr(body.length);
  const subject = typeof body.subject === 'string' ? body.subject : null;
  const context = typeof body.context === 'string' ? body.context : null;
  const instructions = typeof body.instructions === 'string' ? body.instructions : null;

  if (!f && !t && !l && !subject && !context && !instructions) return null;

  const flow: Flow | null = isOneOf<Flow>(f, ['reply', 'compose', 'rewrite', 'grammar']);
  const tone: Tone | null = isOneOf<Tone>(t, [
    'neutral',
    'friendly',
    'formal',
    'concise',
    'enthusiastic',
    'apologetic',
  ]);
  const length: Length | null = isOneOf<Length>(l, ['short', 'medium', 'long']);

  // Require flow + tone + length to build; otherwise, fall back to legacy prompt.
  if (!flow || !tone || !length) return null;
  return { flow, tone, length, subject, context, instructions };
}

function normStr(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().toLowerCase() : null;
}
function isOneOf<T extends string>(v: string | null, xs: readonly T[]): T | null {
  return v && (xs as readonly string[]).includes(v) ? (v as T) : null;
}

function streamStub(
  res: http.ServerResponse,
  req: http.IncomingMessage,
  prompt: string,
  maxTokens?: number,
  delayMs?: number
) {
  sseEvent(res, 'meta', { source: 'stub', started_at: new Date().toISOString() });
  const draft =
    `Hello,\n\nThanks for your note. Here's a short first draft based on your request:\n\n` +
    prompt.slice(0, 200) +
    `\n\nBest regards,\nUSB-LLM`;
  const chunks = tokenizeForDemo(draft, maxTokens ?? 120);
  const delay = clamp(delayMs ?? 40, 10, 200);
  let i = 0;
  const ping = setInterval(() => sseEvent(res, 'ping', {}), 15000);
  const tick = setInterval(() => {
    if (i >= chunks.length) {
      clearInterval(tick);
      clearInterval(ping);
      return sseEnd(res);
    }
    sseEvent(res, 'token', { text: chunks[i++] });
  }, delay);
  req.on('close', () => {
    clearInterval(tick);
    clearInterval(ping);
  });
}

function tokenizeForDemo(text: string, maxTokens: number): string[] {
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
  server.close(async () => {
    await stopLlama().catch(() => {});
    console.log('[usb-llm] Closed.');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

listenWithRetry(DEFAULT_PORT, MAX_RETRIES);
