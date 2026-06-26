'use client';

import { useRouter } from 'next/navigation';
import ConversationUI from '@/components/ConversationUI';

export default function StartPage() {
  const router = useRouter();

  function handleComplete(idea: string) {
    // Hand the synthesized brief to the generation page, which auto-launches.
    sessionStorage.setItem('genesis_idea', idea);
    router.push('/generate');
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-ink">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">
            Parle à <span className="text-gradient">GENESIS</span>
          </h1>
          <p className="mt-3 text-white/55">
            Quelques questions, et on construit tout ton écosystème digital.
          </p>
        </header>

        <ConversationUI onComplete={handleComplete} />
      </div>
    </main>
  );
}
