import type { LauncherConfig } from './config.js';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type UpstreamChunk =
  | { type: 'delta'; text: string }
  | { type: 'done' }
  | { type: 'meta'; raw: unknown };

type ChatStreamJSON = {
  choices?: Array<{
    delta?: { content?: string; role?: 'assistant' | 'system' | 'user' };
    text?: string;
    finish_reason?: string | null;
  }>;
};

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
  userContent: string,
  systemOverride?: string
): AsyncGenerator<UpstreamChunk, void, void> {
  if (!cfg.upstreamUrl) {
    yield { type: 'meta', raw: { source: 'stub' } };
    yield { type: 'done' };
    return;
  }

  const url = new URL('/v1/chat/completions', cfg.upstreamUrl).toString();

  const messages: ChatMessage[] = [
    { role: 'system', content: systemOverride || 'You are a concise business email assistant.' },
    { role: 'user', content: userContent },
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

  yield { type: 'meta', raw: { source: 'llama-server', url: cfg.upstreamUrl, model: cfg.model } };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

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
          if (piece) yield { type: 'delta', text: piece };
          else yield { type: 'meta', raw: parsed };
        } catch {
          // ignore non-JSON data lines
        }
      }
    }
  }

  yield { type: 'done' };
}
