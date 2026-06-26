import { runConversation } from '@genesis/engine';
import type { ConversationMessage, ConversationResult } from '@genesis/engine';

export const runtime = 'nodejs';

/**
 * Guided intake endpoint. POST { messages: ConversationMessage[] } → the next
 * assistant move (a question, or — when done — a summary + brief for the pipeline).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { messages?: ConversationMessage[] };
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const result: ConversationResult = await runConversation(messages);
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: (err as Error).message ?? 'conversation failed' },
      { status: 500 },
    );
  }
}
