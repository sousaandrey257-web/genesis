/**
 * GENESIS engine CLI.
 *
 *   Generate a site:
 *     ANTHROPIC_API_KEY=... npm run engine -- "Salon de coiffure haut de gamme à Lyon"
 *
 *   Run the 30-day maintenance check (assess + regenerate if dated):
 *     npm run engine -- update "<same idea>" 2026-01-01
 *     npm run engine -- update "<same idea>" 2026-01-01 --dry   # assess only
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

// Load .env if present (Node 20.6+). The web app loads it via Next.js; the CLI
// has to do it itself. `npm run engine` runs from apps/engine, so also look up
// at the monorepo root. First existing file wins; silent if none.
{
  const load = (process as NodeJS.Process & { loadEnvFile?: (p?: string) => void })
    .loadEnvFile;
  const candidates = [
    join(process.cwd(), '.env'),
    join(process.cwd(), '..', '..', '.env'),
  ];
  for (const p of candidates) {
    try {
      load?.(p);
      break;
    } catch {
      /* try next candidate */
    }
  }
}

import type { GeneratedSite, StreamEvent } from '@genesis/shared';
import { runPipeline } from './Orchestrator';
import { runTranslator } from './agents/TranslatorAgent';
import { runAnalyzer } from './agents/AnalyzerAgent';
import { runUpdateCycle } from './update';

function logEvent(e: StreamEvent) {
  const tag = e.status === 'error' ? '⚠' : ' ';
  console.log(`${tag}[${String(e.progress).padStart(3)}%] ${e.stage.padEnd(12)} ${e.message}`);
}

async function writeSite(site: GeneratedSite): Promise<string> {
  const outDir = join(process.cwd(), 'generated-sites', site.id);
  await mkdir(outDir, { recursive: true });
  for (const f of site.files) {
    const full = join(outDir, f.path);
    await mkdir(join(full, '..'), { recursive: true });
    await writeFile(full, f.content, 'utf8');
  }
  return outDir;
}

async function generate(idea: string) {
  const gen = runPipeline({ idea });
  let result = await gen.next();
  while (!result.done) {
    logEvent(result.value);
    result = await gen.next();
  }
  const site = result.value;
  const outDir = await writeSite(site);
  console.log(`\n✓ Done. ${site.files.length} files written to ${outDir}`);
  if (site.deployUrl) console.log(`  Live: ${site.deployUrl}`);
}

async function update(args: string[]) {
  const dryRun = args.includes('--dry');
  const rest = args.filter((a) => a !== '--dry');
  const lastBuiltISO = rest.pop();
  const idea = rest.join(' ').trim();
  if (!idea || !lastBuiltISO) {
    console.error('Usage: npm run engine -- update "<idea>" <lastBuiltISO> [--dry]');
    process.exit(1);
  }

  // Rebuild the brief from the idea so the assessment has sector/tone context.
  const translation = await runTranslator(idea);
  const brief = await runAnalyzer(translation.englishText, translation.detectedLanguage);

  const res = await runUpdateCycle({
    request: { idea },
    brief,
    lastBuiltISO,
    dryRun,
    onEvent: logEvent,
  });

  console.log(`\nMise à jour nécessaire : ${res.assessment.needsUpdate ? 'OUI' : 'non'}`);
  if (res.assessment.reasons.length) console.log('Raisons : ' + res.assessment.reasons.join(' • '));
  if (res.regenerated && res.site) {
    const outDir = await writeSite(res.site);
    console.log(`\n✓ Régénéré. ${res.site.files.length} fichiers écrits dans ${outDir}`);
  } else if (res.assessment.needsUpdate && dryRun) {
    console.log('(--dry : régénération non effectuée)');
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === 'update') {
    await update(argv.slice(1));
    return;
  }
  const idea = argv.join(' ').trim();
  if (!idea) {
    console.error('Usage: npm run engine -- "your idea here"');
    process.exit(1);
  }
  await generate(idea);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
