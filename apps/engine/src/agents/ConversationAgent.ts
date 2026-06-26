import { askJSON } from '../llm';

/** A single turn in the intake conversation. */
export interface ConversationMessage {
  role: 'assistant' | 'user';
  content: string;
}

/** The decision the consultant makes after each user turn. */
export interface ConversationResult {
  /** The next assistant message (a question, or the final summary). */
  reply: string;
  /** True when enough info is gathered (or the 5-question ceiling is reached). */
  done: boolean;
  /** How many questions have been asked so far (1..5). */
  questionNumber: number;
  /** Present when done: a friendly recap, e.g. "Parfait ! Je vais créer … C'est bien ça ?". */
  summary?: string;
  /** Present when done: a synthesized paragraph to pass as runPipeline({ idea }). */
  ideaForPipeline?: string;
}

/** Shape we ask the model to return — mirrors ConversationResult, validated below. */
interface RawConversationResult {
  reply?: unknown;
  done?: unknown;
  questionNumber?: unknown;
  summary?: unknown;
  ideaForPipeline?: unknown;
}

const MAX_QUESTIONS = 5;

/** Safe, warm opener used when the model errors or the conversation is empty. */
const FALLBACK_FIRST_QUESTION =
  'Bonjour ! Je suis le consultant produit de GENESIS et je vais créer votre site. ' +
  "Pour commencer, comment s'appelle votre entreprise et que proposez-vous ?";

const SYSTEM = `You are GENESIS, a warm, sharp product consultant who interviews a client to build their website.

Your job: run a guided intake of AT MOST ${MAX_QUESTIONS} questions, ONE question per turn, then synthesize a rich brief.

Cover these topics adaptively (skip what the client already volunteered, merge related ones, reorder to feel natural):
1. Business name and what they do (sector/activity).
2. Primary goal: sell online vs. simply showcase / get contacted.
3. Current traction: roughly how many clients or how much activity per month.
4. Advertising / marketing budget.
5. Language(s) the site should speak, and location/city.

Adapt to the answers:
- Luxury / premium / high-end cues ("haut de gamme", "luxe", "exclusif") → ask premium-positioning questions (booking by appointment, bespoke services, refined tone).
- Budget-conscious cues ("petit budget", "pas cher", "je débute") → keep recommendations lean and reassuring; do not push expensive features.
- If they want to sell, probe payment/online-store needs; if showcase, probe contact/booking needs.

Language: detect the language the USER writes in and ALWAYS reply in that same language. Default to French if the conversation is empty or ambiguous.

Tone: friendly, concise, expert, never robotic. Acknowledge what they said before asking the next thing. One question at a time — never bundle multiple questions.

Stop when you have enough to brief a builder, OR once ${MAX_QUESTIONS} questions have been asked. When you stop, set done=true and:
- "summary": a friendly confirmation recapping what you understood, ending by asking them to confirm (e.g. in French: "Parfait ! Je vais créer … C'est bien ça ?").
- "ideaForPipeline": a single detailed paragraph (English or the client's language is fine) describing: business name, sector, location, target audience, desired tone, whether it sells online / needs payment, whether it needs booking/appointments, and the language(s) of the site. This paragraph is fed directly to the build pipeline, so make it concrete and self-contained.

Counting: "questionNumber" is the total number of questions asked so far INCLUDING the one you are sending now. It must be between 1 and ${MAX_QUESTIONS}. If done=true and you are not asking a new question, keep it at the count already reached.

Output STRICT JSON only:
{
  "reply": string,            // the assistant's next message (a question, or — when done — the summary text)
  "done": boolean,
  "questionNumber": number,   // 1..${MAX_QUESTIONS}
  "summary": string,          // only when done; otherwise ""
  "ideaForPipeline": string   // only when done; otherwise ""
}`;

/** Count how many assistant turns (questions) already happened. */
function priorQuestions(messages: ConversationMessage[]): number {
  return messages.filter((m) => m.role === 'assistant').length;
}

/** Render the transcript for the model. */
function renderTranscript(messages: ConversationMessage[]): string {
  if (messages.length === 0) {
    return '(The conversation is empty. Send the FIRST question now.)';
  }
  return messages
    .map((m) => `${m.role === 'assistant' ? 'GENESIS' : 'Client'}: ${m.content}`)
    .join('\n');
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * Drive the intake conversation. Given the transcript so far (possibly empty →
 * the first question is returned), the model decides the next move: ask the next
 * adaptive question, or — once it has enough or has hit the 5-question ceiling —
 * finish with a confirmation summary and a synthesized brief for the pipeline.
 *
 * Always resolves: on model/parse failure it falls back to a safe opener so the
 * intake never crashes the UI.
 */
export async function runConversation(
  messages: ConversationMessage[],
): Promise<ConversationResult> {
  const askedBefore = priorQuestions(messages);

  try {
    const raw = await askJSON<RawConversationResult>({
      label: 'ConversationAgent',
      maxTokens: 1200,
      system: SYSTEM,
      user:
        `Conversation so far:\n${renderTranscript(messages)}\n\n` +
        `Questions already asked: ${askedBefore} (max ${MAX_QUESTIONS}).\n` +
        'Decide the next move and return the STRICT JSON object.',
    });

    const reply = asString(raw.reply).trim();
    if (!reply) throw new Error('empty reply from model');

    // Force completion once the ceiling is reached, whatever the model claims.
    const reachedCeiling = askedBefore >= MAX_QUESTIONS;
    const done = reachedCeiling || raw.done === true;

    const summary = asString(raw.summary).trim();
    const ideaForPipeline = asString(raw.ideaForPipeline).trim();

    // Clamp the counter to a sane 1..MAX range.
    const rawNumber =
      typeof raw.questionNumber === 'number' && Number.isFinite(raw.questionNumber)
        ? Math.round(raw.questionNumber)
        : askedBefore + (done ? 0 : 1);
    const questionNumber = Math.min(MAX_QUESTIONS, Math.max(1, rawNumber));

    if (done) {
      return {
        reply,
        done: true,
        questionNumber,
        summary: summary || reply,
        ideaForPipeline:
          ideaForPipeline ||
          // Last-resort brief so the pipeline always receives something usable.
          messages
            .filter((m) => m.role === 'user')
            .map((m) => m.content)
            .join(' '),
      };
    }

    return { reply, done: false, questionNumber };
  } catch {
    // Never crash the intake: open (or re-open) with the safe first question.
    if (askedBefore === 0) {
      return { reply: FALLBACK_FIRST_QUESTION, done: false, questionNumber: 1 };
    }
    return {
      reply:
        'Pouvez-vous préciser un dernier point sur votre projet ? ' +
        'Par exemple votre objectif principal avec ce site.',
      done: false,
      questionNumber: Math.min(MAX_QUESTIONS, askedBefore + 1),
    };
  }
}
