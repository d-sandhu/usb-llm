import type { LauncherConfig } from './config.js';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type UpstreamChunk =
  | { type: 'delta'; text: string }
  | { type: 'done' }
  | { type: 'meta'; raw: unknown };

// Minimal shape we care about from OpenAI/llama-server stream chunks
type ChatStreamJSON = {
  choices?: Array<{
    delta?: { content?: string; role?: 'assistant' | 'system' | 'user' };
    text?: string; // some servers use this instead of delta.content
    finish_reason?: string | null;
  }>;
};

/** Extract streamed text from a parsed chunk; returns null if not present. */
function extractDeltaText(obj: unknown): string | null {
  if (typeof obj !== 'object' || obj === null) return null;
  const o = obj as ChatStreamJSON;
  const c0 = o.choices?.[0];
  if (!c0) return null;

  const delta = c0.delta?.content;
  if (typeof delta === 'string' && delta.length) return delta;

  const text = c0.text;
  if (typeof text === 'string' && text.length) return text;

  return null;
}

export async function* streamChat(
  cfg: LauncherConfig,
  prompt: string
): AsyncGenerator<UpstreamChunk, void, void> {
  if (!cfg.upstreamUrl) {
    // In stub mode we just emit meta+done; caller handles stub path separately
    yield { type: 'meta', raw: { source: 'stub' } };
    yield { type: 'done' };
    return;
  }

  const url = new URL('/v1/chat/completions', cfg.upstreamUrl).toString();

  const messages: ChatMessage[] = [
    { role: 'system', content: 'You are a concise business email assistant.' },
    { role: 'user', content: prompt },
  ];

  const body = {
    model: cfg.model,
    messages,
    temperature: cfg.temperature,
    stream: true,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Upstream error: ${res.status} ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // Small meta for the client
  yield { type: 'meta', raw: { source: 'llama-server', url: cfg.upstreamUrl, model: cfg.model } };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      // Collect data lines (ignore event: lines, comments, etc.)
      const dataLines = frame
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .filter(Boolean);

      for (const data of dataLines) {
        if (data === '[DONE]') {
          yield { type: 'done' };
          return;
        }
        try {
          const parsed: unknown = JSON.parse(data);
          const piece = extractDeltaText(parsed);
          if (piece) {
            yield { type: 'delta', text: piece };
          } else {
            // Not a delta chunk; surface for debugging/telemetry
            yield { type: 'meta', raw: parsed };
          }
        } catch {
          // Non-JSON data lines can be ignored safely
        }
      }
    }
  }

  // In case we never saw [DONE], still conclude the stream
  yield { type: 'done' };
}
