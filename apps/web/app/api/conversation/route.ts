import { runConversation } from '@genesis/engine';
import type { ConversationMessage, ConversationResult } from '@genesis/engine';
import { isDemoMode, demoConversation, type Lang } from '@/lib/demo';

export const runtime = 'nodejs';

/**
 * Guided intake endpoint. POST { messages: ConversationMessage[], lang? } → the
 * next assistant move (a question, or — when done — a summary + brief). In demo
 * mode (no Anthropic key) it returns a scripted conversation so the showcase
 * works without any API key.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { messages?: ConversationMessage[]; lang?: Lang };
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const lang: Lang = body?.lang === 'en' ? 'en' : 'fr';

    if (isDemoMode()) {
      return Response.json(demoConversation(messages, lang));
    }

    const result: ConversationResult = await runConversation(messages);
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: (err as Error).message ?? 'conversation failed' },
      { status: 500 },
    );
  }
}
