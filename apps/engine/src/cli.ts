/**
 * Run the GENESIS pipeline from the terminal:
 *   ANTHROPIC_API_KEY=... npm run engine -- "Salon de coiffure haut de gamme à Lyon"
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { runPipeline } from './Orchestrator';

async function main() {
  const idea = process.argv.slice(2).join(' ').trim();
  if (!idea) {
    console.error('Usage: npm run engine -- "your idea here"');
    process.exit(1);
  }

  const gen = runPipeline({ idea });
  let result = await gen.next();
  while (!result.done) {
    const e = result.value;
    console.log(`[${String(e.progress).padStart(3)}%] ${e.stage.padEnd(12)} ${e.message}`);
    result = await gen.next();
  }

  const site = result.value;
  const outDir = join(process.cwd(), 'generated-sites', site.id);
  await mkdir(outDir, { recursive: true });
  for (const f of site.files) {
    const full = join(outDir, f.path);
    await mkdir(join(full, '..'), { recursive: true });
    await writeFile(full, f.content, 'utf8');
  }
  console.log(`\n✓ Done. ${site.files.length} files written to ${outDir}`);
  if (site.deployUrl) console.log(`  Live: ${site.deployUrl}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
