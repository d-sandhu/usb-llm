import { useState } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';

type Status = 'idle' | 'streaming' | 'error';

async function streamDraft(prompt: string, onToken: (t: string) => void, onDone: () => void) {
  const ctrl = new AbortController();

  await fetchEventSource('/api/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, max_tokens: 200 }),
    signal: ctrl.signal,

    async onopen(res) {
      const ctype = res.headers.get('content-type') ?? '';
      if (!res.ok || !ctype.includes('text/event-stream')) {
        throw new Error(`Unexpected response: ${res.status} ${ctype}`);
      }
    },

    onmessage(ev) {
      if (ev.event === 'token') {
        try {
          const { text } = JSON.parse(ev.data) as { text?: string };
          if (text) onToken(text);
        } catch {
          /* ignore malformed frames */
        }
      } else if (ev.event === 'done') {
        onDone();
        ctrl.abort();
      }
    },

    onerror(err) {
      throw err; // surface to caller
    },
  });
}

function App() {
  const [prompt, setPrompt] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>('idle');

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setDraft('');
    setBusy(true);
    setStatus('streaming');

    try {
      await streamDraft(
        prompt,
        (t) => setDraft((d) => d + t),
        () => setStatus('idle')
      );
    } catch (err) {
      console.error(err);
      setStatus('error');
    } finally {
      setBusy(false);
    }
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
          <button type="submit" disabled={busy || !prompt.trim()}>
            {busy ? 'Generating…' : 'Generate draft'}
          </button>
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
        <span style={{ color: status === 'error' ? '#b00' : '#555' }}>
          {status === 'streaming'
            ? 'Streaming…'
            : status === 'error'
              ? 'Error (see console)'
              : 'Ready'}
        </span>
      </div>
    </div>
  );
}

export default App;
