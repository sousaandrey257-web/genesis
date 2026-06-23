import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

/**
 * Chatbot endpoint embedded in every generated site. Accepts
 * { messages: {role, content}[], context?: string } and replies with text.
 */
export async function POST(req: Request) {
  const { messages, context } = (await req.json()) as {
    messages: { role: 'user' | 'assistant'; content: string }[];
    context?: string;
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ reply: 'Chatbot non configuré (ANTHROPIC_API_KEY manquante).' });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system:
      'You are the helpful AI assistant embedded in a business website. ' +
      'Answer concisely in the visitor’s language. ' +
      (context ? `Business context: ${context}` : ''),
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const reply = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return Response.json({ reply });
}
