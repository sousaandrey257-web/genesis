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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Retry a fallible LLM call with exponential backoff. Covers transient API
 * errors (5xx/429/network) AND downstream failures like JSON that won't parse —
 * the callback simply throws and we re-run it. Throws the last error after all
 * attempts are exhausted, tagged with the label for diagnosis.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  label: string,
  attempts = 3,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt < attempts) {
        const backoff = 400 * 2 ** (attempt - 1); // 400, 800, 1600…
        await sleep(backoff);
      }
    }
  }
  throw new Error(
    `[${label}] failed after ${attempts} attempts: ${(lastErr as Error)?.message ?? lastErr}`,
  );
}

/**
 * Ask Claude for a JSON object and parse it robustly.
 * The prompt should describe the exact shape; we enforce JSON-only output.
 */
export async function askJSON<T>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  label?: string;
}): Promise<T> {
  return withRetry(async (attempt) => {
    const res = await getClient().messages.create({
      model: REASONING_MODEL,
      max_tokens: opts.maxTokens ?? 2000,
      system:
        opts.system +
        '\n\nRespond with ONLY valid JSON. No prose, no markdown fences.' +
        (attempt > 1 ? '\nYour previous answer was not valid JSON — return STRICT JSON only.' : ''),
      messages: [{ role: 'user', content: opts.user }],
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return extractJSON<T>(text); // throws on unparseable JSON → retried
  }, opts.label ?? 'askJSON');
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
  label?: string;
}): Promise<string> {
  return withRetry(async () => {
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
    if (!full.trim()) throw new Error('empty response from coder model');
    return full;
  }, opts.label ?? 'streamCode');
}

export { CODER_MODEL, REASONING_MODEL };
