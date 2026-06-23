import Anthropic from '@anthropic-ai/sdk';

const CODER_MODEL = process.env.GENESIS_CODER_MODEL || 'claude-sonnet-4-6';
const REASONING_MODEL = process.env.GENESIS_REASONING_MODEL || 'claude-sonnet-4-6';

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in.');
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/**
 * Ask Claude for a JSON object and parse it robustly.
 * The prompt should describe the exact shape; we enforce JSON-only output.
 */
export async function askJSON<T>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<T> {
  const res = await getClient().messages.create({
    model: REASONING_MODEL,
    max_tokens: opts.maxTokens ?? 2000,
    system: opts.system + '\n\nRespond with ONLY valid JSON. No prose, no markdown fences.',
    messages: [{ role: 'user', content: opts.user }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return extractJSON<T>(text);
}

/** Pull the first JSON object/array out of a model response, tolerating fences. */
export function extractJSON<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/[{[][\s\S]*[}\]]/);
    if (!match) throw new Error('No JSON found in model response:\n' + text.slice(0, 500));
    return JSON.parse(match[0]) as T;
  }
}

/**
 * Stream code generation for a single file. Calls onToken with each delta so the
 * frontend can render the file appearing live. Returns the full content.
 */
export async function streamCode(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  onToken?: (delta: string) => void;
}): Promise<string> {
  let full = '';
  const stream = getClient().messages.stream({
    model: CODER_MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
  });

  stream.on('text', (delta) => {
    full += delta;
    opts.onToken?.(delta);
  });

  await stream.finalMessage();
  return full;
}

export { CODER_MODEL, REASONING_MODEL };
