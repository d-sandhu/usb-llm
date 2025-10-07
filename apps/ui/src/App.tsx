import { useEffect, useRef, useState } from 'react';

type Flow = 'reply' | 'compose' | 'rewrite';
type Tone = 'neutral' | 'friendly' | 'formal' | 'concise' | 'enthusiastic' | 'apologetic';
type Length = 'short' | 'medium' | 'long';

type SelectedModel =
  | { status: 'none' }
  | {
      status: 'ok' | 'missing';
      id: string | null;
      name: string | null;
      basename: string | null;
      license: string | null;
      ctx: number | null;
      quant: string | null;
    };

type ModelsResp = {
  selected: SelectedModel;
  ui: { allowSelection: boolean };
};

type HealthResp = {
  ok: boolean;
  mode: 'stub' | 'upstream';
  submode: 'external' | 'local-idle' | 'local-ready' | null;
  runtime?: { source: 'upstream' | 'local' | 'none'; selectedModelId: string | null };
};

async function streamDraft(
  body: unknown,
  controller: AbortController,
  onToken: (t: string) => void
) {
  const res = await fetch('/api/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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

  const onAbort = () => {
    reader.cancel().catch(() => {
      /* ignore */
    });
  };
  controller.signal.addEventListener('abort', onAbort);

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);

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
          } catch (err) {
            void err; // keep ESLint happy; non-JSON frames can be ignored
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

const TONES: Tone[] = ['neutral', 'friendly', 'formal', 'concise', 'enthusiastic', 'apologetic'];
const LENGTHS: Length[] = ['short', 'medium', 'long'];

function App() {
  // flow state
  const [flow, setFlow] = useState<Flow>('compose');
  const [tone, setTone] = useState<Tone>('neutral');
  const [len, setLen] = useState<Length>('medium');

  // shared fields
  const [subject, setSubject] = useState('');
  const [instructions, setInstructions] = useState(''); // what we want
  const [context, setContext] = useState(''); // original email / thread

  // streaming state
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // diagnostics
  const [model, setModel] = useState<SelectedModel>({ status: 'none' });
  const [health, setHealth] = useState<HealthResp | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const statusMessage = error
    ? `Error: ${error}`
    : stopping
      ? 'Stopping…'
      : busy
        ? 'Streaming…'
        : 'Ready';

  useEffect(() => {
    (async () => {
      try {
        const [m, h] = await Promise.all([
          fetch('/v1/models').then((r) => r.json() as Promise<ModelsResp>),
          fetch('/healthz').then((r) => r.json() as Promise<HealthResp>),
        ]);
        setModel(m.selected);
        setHealth(h);
      } catch {
        // Stub mode still fine
      }
    })();
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  function canSubmit(): boolean {
    // Need something to work with:
    // - compose: instructions or context
    // - reply/rewrite: context OR (instructions if you really want a blank rewrite/reply)
    if (flow === 'compose') return Boolean(instructions.trim() || context.trim());
    return Boolean(context.trim() || instructions.trim());
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (busy || stopping || abortRef.current) return;
    if (!canSubmit()) {
      setError('Please add instructions and/or context first.');
      return;
    }

    setDraft('');
    setError(null);
    setBusy(true);

    const ac = new AbortController();
    abortRef.current = ac;

    const body = {
      flow,
      tone,
      length: len,
      subject: subject.trim() || null,
      context: context.trim() || null,
      instructions: instructions.trim() || null,
    };

    try {
      await streamDraft(body, ac, (t) => setDraft((d) => d + t));
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

  function ModeChip() {
    const m = health?.mode ?? 'stub';
    const s = health?.submode ?? null;
    const text =
      m === 'upstream'
        ? s === 'external'
          ? 'Mode: Upstream'
          : s === 'local-ready'
            ? 'Mode: Local (ready)'
            : s === 'local-idle'
              ? 'Mode: Local (idle)'
              : 'Mode: Upstream'
        : 'Mode: Stub';
    return (
      <span style={{ background: '#eee', padding: '2px 8px', borderRadius: 12, fontSize: 12 }}>
        {text}
      </span>
    );
  }

  function ModelChip() {
    if (model.status === 'ok') {
      return (
        <span
          title={model.id || undefined}
          style={{ background: '#eef8ee', padding: '2px 8px', borderRadius: 12, fontSize: 12 }}
        >
          Model: {model.name || model.basename || 'Selected'}{' '}
          {model.license ? `(${model.license})` : ''}
        </span>
      );
    }
    if (model.status === 'missing') {
      return (
        <span
          style={{ background: '#fff4e5', padding: '2px 8px', borderRadius: 12, fontSize: 12 }}
          title="Model file not found; running in Stub mode."
        >
          Model: missing
        </span>
      );
    }
    return (
      <span style={{ background: '#eee', padding: '2px 8px', borderRadius: 12, fontSize: 12 }}>
        Model: none
      </span>
    );
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    color: '#555',
    marginBottom: 6,
  };

  return (
    <div
      style={{
        maxWidth: 860,
        margin: '40px auto',
        padding: 16,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1>USB-LLM</h1>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <ModeChip />
        <ModelChip />
      </div>

      {/* Flow selector */}
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        {(['reply', 'compose', 'rewrite'] as Flow[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFlow(f)}
            disabled={busy}
            style={{
              padding: '6px 10px',
              borderRadius: 12,
              border: '1px solid #ccc',
              background: flow === f ? '#e8f0ff' : '#f9f9f9',
            }}
            title={
              f === 'reply'
                ? 'Reply to an incoming email'
                : f === 'compose'
                  ? 'Compose a new email'
                  : 'Rewrite an existing email'
            }
          >
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Tone + Length presets */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <span style={labelStyle}>Tone</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TONES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTone(t)}
                disabled={busy}
                style={{
                  padding: '4px 8px',
                  borderRadius: 10,
                  border: '1px solid #ccc',
                  background: tone === t ? '#e6fff0' : '#f9f9f9',
                  fontSize: 12,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span style={labelStyle}>Length</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {LENGTHS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLen(l)}
                disabled={busy}
                style={{
                  padding: '4px 8px',
                  borderRadius: 10,
                  border: '1px solid #ccc',
                  background: len === l ? '#fff8e6' : '#f9f9f9',
                  fontSize: 12,
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <form onSubmit={handleGenerate}>
        {/* Subject (optional) */}
        <label style={labelStyle}>Subject (optional)</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={busy}
          placeholder="Follow-up on Q3 report"
          style={{ width: '100%', padding: 10, marginBottom: 10 }}
        />

        {/* Context / Original */}
        {(flow === 'reply' || flow === 'rewrite') && (
          <>
            <label style={labelStyle}>
              {flow === 'reply' ? 'Original email / thread' : 'Original text to rewrite'}
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={8}
              disabled={busy}
              placeholder={
                flow === 'reply'
                  ? 'Paste the incoming email or thread here…'
                  : 'Paste the text you want rewritten…'
              }
              style={{
                width: '100%',
                padding: 12,
                fontSize: 14,
                resize: 'vertical',
                marginBottom: 10,
              }}
            />
          </>
        )}

        {/* Instructions */}
        <label style={labelStyle}>
          {flow === 'compose'
            ? 'What should the email say?'
            : flow === 'reply'
              ? 'Any extra guidance for the reply? (optional)'
              : 'Rewrite guidance (optional)'}
        </label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={flow === 'compose' ? 8 : 4}
          disabled={busy}
          placeholder={
            flow === 'compose'
              ? 'Keep it friendly and ask for a 20-minute sync next week about the Q3 numbers.'
              : flow === 'reply'
                ? 'Acknowledge their delay, confirm the new deadline, and ask for the updated deck.'
                : 'Make it friendlier and shorter while preserving key details.'
          }
          style={{ width: '100%', padding: 12, fontSize: 14, resize: 'vertical' }}
        />

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {!busy ? (
            <button type="submit" disabled={!canSubmit()}>
              Generate draft
            </button>
          ) : (
            <button type="button" onClick={handleStop}>
              Stop
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setSubject('');
              setInstructions('');
              setContext('');
              setDraft('');
              setError(null);
            }}
            disabled={busy}
          >
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
          minHeight: 160,
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
