import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';

const HOST = '127.0.0.1';

// Shared singleton state (simple and sufficient for v0.1)
let proc: ChildProcess | null = null;
let url: string | null = null;
let starting: Promise<string> | null = null;

export type StartOpts = {
  binPath: string;
  modelFile: string;
  preferPort?: number | null; // if unavailable, we'll increment
  ctxSize?: number | null;
  threads?: number | null;
  tempDir?: string | null;
  logDisable?: boolean;
};

/** Pick a free TCP port on HOST, starting at base, up to N attempts. */
async function findFreePort(base = 8080, maxTries = 20): Promise<number> {
  for (let i = 0; i < maxTries; i++) {
    const port = base + i;
    const ok = await canListen(port);
    if (ok) return port;
  }
  throw new Error('No free port found');
}

function canListen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.listen(port, HOST, () => {
      s.close(() => resolve(true));
    });
  });
}

function waitForTcp(port: number, timeoutMs = 40_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const sock = net.createConnection({ host: HOST, port }, () => {
        sock.end();
        resolve();
      });
      sock.once('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error('Timeout waiting for TCP'));
        else setTimeout(attempt, 250);
      });
    };
    attempt();
  });
}

/** Start llama-server and wait until TCP accept works. */
export async function ensureStarted(opts: StartOpts): Promise<string> {
  if (url) return url;
  if (starting) return starting;

  starting = (async () => {
    const port = opts.preferPort ?? (await findFreePort(8080, 20));
    const args = ['-m', opts.modelFile, '--host', HOST, '--port', String(port)];

    if (typeof opts.ctxSize === 'number' && Number.isFinite(opts.ctxSize)) {
      args.push('--ctx-size', String(opts.ctxSize));
    }
    if (typeof opts.threads === 'number' && Number.isFinite(opts.threads)) {
      args.push('--threads', String(opts.threads));
    }
    if (opts.tempDir) {
      args.push('--temp-dir', opts.tempDir);
    }
    if (opts.logDisable) {
      args.push('--log-disable');
    }

    // Keep it quiet; for debugging switch to 'inherit'
    proc = spawn(opts.binPath, args, { stdio: 'ignore' });

    proc.once('exit', (code, signal) => {
      // Reset state if it dies unexpectedly
      if (url && code !== 0) {
        console.error('[usb-llm] llama-server exited:', { code, signal });
      }
      proc = null;
      url = null;
      starting = null;
    });

    await waitForTcp(port); // server accepts connections
    url = `http://${HOST}:${port}`;
    return url;
  })();

  try {
    return await starting;
  } finally {
    starting = null; // allow re-entry if something failed after start
  }
}

export async function stop(): Promise<void> {
  const p = proc;
  proc = null;
  url = null;
  starting = null;

  if (!p) return;
  return new Promise((resolve) => {
    p.once('exit', () => resolve());
    // Try graceful first
    p.kill('SIGINT');
    setTimeout(() => {
      try {
        p.kill('SIGKILL');
      } catch (e: unknown) {
        void e;
      }
    }, 1500).unref();
  });
}

/** Current URL if running (else null). */
export function currentUrl(): string | null {
  return url;
}
