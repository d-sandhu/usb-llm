import { useEffect, useRef, useState } from 'react';

async function streamDraft(
  prompt: string,
  controller: AbortController,
  onToken: (t: string) => void
) {
  const res = await fetch('/api/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, max_tokens: 200 }),
    signal: controller.signal,
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const ctype = res.headers.get('content-type') ?? '';
  if (!ctype.includes('text/event-stream')) {
    throw new Error(`Unexpected content-type: ${ctype}`);
  }

  if (!res.body) return;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // Clean up reader when aborted
  const onAbort = () => {
    reader.cancel().catch(() => {
      /* ignore cancel errors */
    });
  };
  controller.signal.addEventListener('abort', onAbort);

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Frames are separated by a blank line
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);

        // Minimal parse: find first "event:" and collect any "data:" lines.
        let event = 'message';
        const dataLines: string[] = [];
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        }
        const data = dataLines.join('\n');

        if (event === 'token') {
          try {
            const obj = JSON.parse(data) as { text?: string };
            if (obj.text) onToken(obj.text);
          } catch {
            /* ignore */
          }
        } else if (event === 'done') {
          return;
        }
      }
    }
  } finally {
    controller.signal.removeEventListener('abort', onAbort);
  }
}

function App() {
  const [prompt, setPrompt] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Derive status message from state
  const statusMessage = error
    ? `Error: ${error}`
    : stopping
      ? 'Stopping…'
      : busy
        ? 'Streaming…'
        : 'Ready';

  useEffect(() => {
    // Cleanup on unmount: cancel any in-flight stream
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    // Prevent double-submit if already busy, stopping, or if abort is in-flight
    if (!prompt.trim() || busy || stopping || abortRef.current) return;

    setDraft('');
    setError(null);
    setBusy(true);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      await streamDraft(prompt, ac, (t) => setDraft((d) => d + t));
    } catch (err) {
      const name = (err as Error)?.name || '';
      if (name !== 'AbortError') {
        const message = (err as Error)?.message || 'Unknown error';
        console.error(err);
        setError(message);
      }
    } finally {
      setBusy(false);
      setStopping(false);
      abortRef.current = null;
    }
  }

  function handleStop(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setStopping(true);
    abortRef.current?.abort();
  }

  function handleCopy() {
    navigator.clipboard.writeText(draft).catch(() => {});
  }

  return (
    <div
      style={{
        maxWidth: 720,
        margin: '40px auto',
        padding: 16,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1>USB-LLM</h1>
      <p style={{ color: '#555' }}>
        Type a brief request and get a streaming first draft (stub or your configured model).
      </p>

      <form onSubmit={handleGenerate}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Draft a friendly follow-up about the Q3 report…"
          rows={6}
          style={{ width: '100%', padding: 12, fontSize: 14, resize: 'vertical' }}
          disabled={busy}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {!busy ? (
            <button type="submit" disabled={!prompt.trim()}>
              Generate draft
            </button>
          ) : (
            <button type="button" onClick={handleStop}>
              Stop
            </button>
          )}
          <button type="button" onClick={() => setPrompt('')} disabled={busy}>
            Clear
          </button>
        </div>
      </form>

      <h2 style={{ marginTop: 24 }}>Draft</h2>
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          background: '#f6f6f6',
          padding: 12,
          minHeight: 120,
          borderRadius: 6,
        }}
      >
        {draft || '—'}
      </pre>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={handleCopy} disabled={!draft}>
          Copy to clipboard
        </button>
        <span style={{ color: error ? '#b00' : '#555' }}>{statusMessage}</span>
      </div>
    </div>
  );
}

export default App;
