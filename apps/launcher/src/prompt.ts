// Small builder to derive system + user prompts from flow/tone/length.
// Keep it minimal and predictable.

export type Flow = 'reply' | 'compose' | 'rewrite';
export type Tone = 'neutral' | 'friendly' | 'formal' | 'concise' | 'enthusiastic' | 'apologetic';
export type Length = 'short' | 'medium' | 'long';

export type BuildArgs = {
  flow: Flow;
  tone: Tone;
  length: Length;
  subject?: string | null;
  context?: string | null; // original email / thread / text
  instructions?: string | null; // user intent for this draft
};

function toneLine(t: Tone): string {
  switch (t) {
    case 'friendly':
      return 'Tone: friendly, warm, and professional.';
    case 'formal':
      return 'Tone: formal, clear, and succinct.';
    case 'concise':
      return 'Tone: concise and to-the-point.';
    case 'enthusiastic':
      return 'Tone: positive and energetic, but still professional.';
    case 'apologetic':
      return 'Tone: empathetic and apologetic without overpromising.';
    default:
      return 'Tone: neutral, straightforward, and professional.';
  }
}

function lengthLine(l: Length): string {
  switch (l) {
    case 'short':
      return 'Length: brief (3–6 sentences).';
    case 'long':
      return 'Length: detailed (8–14 sentences), but avoid redundancy.';
    default:
      return 'Length: medium (5–8 sentences).';
  }
}

export function buildEmailPrompts(a: BuildArgs): { system: string; user: string } {
  const tone = toneLine(a.tone);
  const length = lengthLine(a.length);
  const subject = a.subject?.trim() ? a.subject.trim() : null;
  const context = a.context?.trim() ? a.context.trim() : null;
  const instructions = a.instructions?.trim() ? a.instructions.trim() : null;

  // shared system guidance
  const system = [
    'You are a concise business email assistant.',
    'Write clear, polite, and action-oriented emails.',
    'Avoid hallucinating details. If context is ambiguous, use neutral phrasing.',
    'Never include placeholders like "[NAME]" unless present in the input.',
    tone,
    length,
  ].join(' ');

  if (a.flow === 'reply') {
    const user = [
      'Task: Draft a reply to the email thread below.',
      subject ? `Subject: ${subject}` : null,
      instructions ? `Additional guidance: ${instructions}` : null,
      '',
      '--- Thread start ---',
      context ?? '(no prior email provided)',
      '--- Thread end ---',
    ]
      .filter(Boolean)
      .join('\n');
    return { system, user };
  }

  if (a.flow === 'compose') {
    const user = [
      'Task: Compose a new email.',
      subject ? `Subject: ${subject}` : null,
      instructions ? `What this email should cover: ${instructions}` : null,
      context ? '\nReference notes:\n' + context : null,
    ]
      .filter(Boolean)
      .join('\n');
    return { system, user };
  }

  // rewrite
  const user = [
    'Task: Rewrite the email below to match the requested tone and length.',
    subject ? `Keep subject (if relevant): ${subject}` : null,
    instructions ? `Rewrite guidance: ${instructions}` : null,
    '',
    '--- Original start ---',
    context ?? '(no original text provided)',
    '--- Original end ---',
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}
