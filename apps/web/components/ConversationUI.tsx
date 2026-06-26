'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationMessage, ConversationResult } from '@genesis/engine';
import { ArrowRight, Loader2, Mic, MicOff, Send, Sparkles } from 'lucide-react';

/* ─── Minimal typed shim for the Web Speech API (not in lib.dom by default) ─── */

interface SpeechRecognitionAlternative {
  readonly transcript: string;
}
interface SpeechRecognitionResult {
  readonly 0: SpeechRecognitionAlternative;
  readonly isFinal: boolean;
  readonly length: number;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  readonly [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechWindow extends Window {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/* ─── Chat UI ───────────────────────────────────────────────────────────────── */

interface ChatBubble {
  id: number;
  role: 'assistant' | 'user';
  /** Text revealed so far (assistant bubbles type in word-by-word). */
  shown: string;
  /** Full text; for user bubbles equals `shown`. */
  full: string;
}

interface ConversationUIProps {
  onComplete: (idea: string) => void;
}

let bubbleSeq = 0;
const nextId = (): number => ++bubbleSeq;

export default function ConversationUI({ onComplete }: ConversationUIProps): JSX.Element {
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [finished, setFinished] = useState(false);
  const [summary, setSummary] = useState('');
  const [ideaForPipeline, setIdeaForPipeline] = useState('');
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The full transcript sent to the API (kept in a ref to avoid stale closures).
  const transcriptRef = useRef<ConversationMessage[]>([]);

  const speechSupported = typeof window !== 'undefined' && getSpeechRecognitionCtor() !== null;

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }),
    );
  }, []);

  /** Reveal an assistant reply word-by-word for a live typing effect. */
  const typeAssistant = useCallback(
    (id: number, full: string) => {
      if (typingRef.current) clearInterval(typingRef.current);
      const words = full.split(' ');
      let i = 0;
      typingRef.current = setInterval(() => {
        i += 1;
        const shown = words.slice(0, i).join(' ');
        setBubbles((prev) => prev.map((b) => (b.id === id ? { ...b, shown } : b)));
        scrollToBottom();
        if (i >= words.length && typingRef.current) {
          clearInterval(typingRef.current);
          typingRef.current = null;
        }
      }, 45);
    },
    [scrollToBottom],
  );

  /** POST the current transcript and append GENESIS's reply. */
  const callApi = useCallback(async () => {
    setThinking(true);
    setError(null);
    try {
      const res = await fetch('/api/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: transcriptRef.current }),
      });
      if (!res.ok) throw new Error('La conversation a échoué. Réessayez.');
      const result = (await res.json()) as ConversationResult;

      transcriptRef.current = [
        ...transcriptRef.current,
        { role: 'assistant', content: result.reply },
      ];

      const id = nextId();
      setBubbles((prev) => [...prev, { id, role: 'assistant', shown: '', full: result.reply }]);
      typeAssistant(id, result.reply);

      if (result.done) {
        setSummary(result.summary ?? result.reply);
        setIdeaForPipeline(result.ideaForPipeline ?? '');
        setFinished(true);
      }
    } catch (err) {
      setError((err as Error).message ?? 'Erreur inattendue.');
    } finally {
      setThinking(false);
      scrollToBottom();
    }
  }, [scrollToBottom, typeAssistant]);

  // Kick off the conversation with GENESIS's first question on mount.
  useEffect(() => {
    void callApi();
    return () => {
      if (typingRef.current) clearInterval(typingRef.current);
      recognitionRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || thinking || finished) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
    }
    transcriptRef.current = [...transcriptRef.current, { role: 'user', content: text }];
    setBubbles((prev) => [
      ...prev,
      { id: nextId(), role: 'user', shown: text, full: text },
    ]);
    setInput('');
    scrollToBottom();
    void callApi();
  }, [input, thinking, finished, listening, callApi, scrollToBottom]);

  /** Toggle voice dictation, piping the transcript into the input box. */
  const toggleMic = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new Ctor();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [listening]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <GenesisAvatar thinking={thinking} />
        <div>
          <p className="font-semibold text-white">GENESIS</p>
          <p className="text-sm text-white/40">
            {thinking ? 'réfléchit…' : 'Consultant produit'}
          </p>
        </div>
      </div>

      {/* Transcript */}
      <div
        ref={scrollRef}
        className="flex max-h-[58vh] min-h-[40vh] flex-col gap-4 overflow-y-auto rounded-3xl glass p-5"
      >
        {bubbles.map((b) => (
          <Bubble key={b.id} bubble={b} />
        ))}

        {thinking && !finished && (
          <div className="flex items-center gap-3 animate-fade-up">
            <GenesisAvatar thinking small />
            <ThinkingDots />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}
      </div>

      {/* Confirmation card shown when the intake is done */}
      {finished && (
        <div className="mt-6 animate-fade-up rounded-3xl border border-violet-glow/40 p-6 glass-strong">
          <div className="mb-3 flex items-center gap-2 text-violet-glow">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">Récapitulatif</span>
          </div>
          <p className="mb-5 leading-relaxed text-white/90">{summary}</p>
          <button
            onClick={() => onComplete(ideaForPipeline)}
            disabled={!ideaForPipeline}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-genesis-gradient px-7 py-4 font-semibold text-white transition hover:scale-[1.02] disabled:opacity-50"
          >
            Lancer la génération
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Composer */}
      {!finished && (
        <div className="mt-5 flex items-center gap-2">
          {speechSupported && (
            <button
              type="button"
              onClick={toggleMic}
              aria-label={listening ? 'Arrêter la dictée vocale' : 'Dicter à la voix'}
              aria-pressed={listening}
              className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full glass transition hover:scale-105 ${
                listening ? 'animate-pulse text-red-300 ring-2 ring-red-400/50' : 'text-white/70'
              }`}
            >
              {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
          )}

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send();
            }}
            placeholder={listening ? 'Parlez…' : 'Votre réponse…'}
            disabled={thinking}
            aria-label="Votre réponse"
            className="flex-1 rounded-full glass px-6 py-3.5 text-white placeholder-white/30 outline-none transition focus:ring-2 focus:ring-violet-glow/50"
          />

          <button
            type="button"
            onClick={send}
            disabled={thinking || input.trim().length === 0}
            aria-label="Envoyer"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-genesis-gradient text-white transition hover:scale-105 disabled:opacity-40"
          >
            {thinking ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────────────── */

function Bubble({ bubble }: { bubble: ChatBubble }): JSX.Element {
  const isUser = bubble.role === 'user';
  return (
    <div
      className={`flex animate-fade-up items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && <GenesisAvatar thinking={false} small />}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
          isUser
            ? 'rounded-br-sm bg-genesis-gradient text-white'
            : 'rounded-bl-sm glass-strong text-white/90'
        }`}
      >
        {bubble.shown}
        {!isUser && bubble.shown.length < bubble.full.length && (
          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-violet-glow align-middle" />
        )}
      </div>
    </div>
  );
}

function GenesisAvatar({
  thinking,
  small = false,
}: {
  thinking: boolean;
  small?: boolean;
}): JSX.Element {
  const size = small ? 'h-8 w-8' : 'h-11 w-11';
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-full bg-genesis-gradient ${size} ${
        thinking ? 'animate-pulse' : ''
      }`}
    >
      <Sparkles className={small ? 'h-4 w-4 text-white' : 'h-5 w-5 text-white'} />
      <span
        className={`absolute inset-0 rounded-full bg-violet-glow/40 ${
          thinking ? 'animate-ping' : 'opacity-0'
        }`}
      />
    </div>
  );
}

function ThinkingDots(): JSX.Element {
  return (
    <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm glass-strong px-4 py-3.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 animate-bounce rounded-full bg-white/60"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}
