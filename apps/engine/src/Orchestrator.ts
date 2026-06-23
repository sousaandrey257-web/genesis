import type {
  GenerateRequest,
  GeneratedFile,
  GeneratedSite,
  StreamEvent,
} from '@genesis/shared';
import { runTranslator } from './agents/TranslatorAgent';
import { runAnalyzer } from './agents/AnalyzerAgent';
import { runCompetitor } from './agents/CompetitorAgent';
import { runDesign, generateSeed } from './agents/DesignAgent';
import { runCoder } from './agents/CoderAgent';
import { getTemplate, applyTemplateToBrief, templateToPlan } from './templates';
import { runReviewer } from './agents/ReviewerAgent';
import { runDeployer } from './agents/DeployerAgent';

function id(): string {
  return 'gen_' + generateSeed().slice(0, 12);
}

/**
 * The GENESIS pipeline. Yields StreamEvents step by step so the frontend can
 * render live progress, then yields a final 'deploy'/'done' event whose data is
 * the assembled GeneratedSite.
 */
export async function* runPipeline(
  req: GenerateRequest,
): AsyncGenerator<StreamEvent, GeneratedSite, void> {
  const projectId = req.clientId ? `${req.clientId}-${id()}` : id();

  // ── Step 1: Translate ──────────────────────────────────────────────
  yield ev('translate', 'start', 'Détection de la langue…', 5);
  const translation = await runTranslator(req.idea);
  yield ev('translate', 'done', `Langue détectée : ${translation.languageName}`, 12, translation);

  // ── Step 2: Analyze (+ select sector blueprint) ────────────────────
  yield ev('analyze', 'start', 'Analyse de ton idée…', 18);
  const rawBrief = await runAnalyzer(translation.englishText, translation.detectedLanguage);
  const template = getTemplate(rawBrief.type);
  const brief = applyTemplateToBrief(rawBrief, template);
  yield ev(
    'analyze',
    'done',
    `${template.label} • ${brief.sector} • ${brief.businessName}`,
    28,
    { brief, template: template.label },
  );

  // ── Step 3: Competitors ────────────────────────────────────────────
  yield ev('competitors', 'start', 'Analyse de 20 concurrents…', 34);
  const competitor = await runCompetitor(brief);
  yield ev(
    'competitors',
    'done',
    `Positionnement gagnant identifié (${competitor.topWeaknesses.length} faiblesses exploitées)`,
    46,
    competitor,
  );

  // ── Step 4: Design (deterministic, unique — seed derived from siteId) ─
  yield ev('design', 'start', 'Création de ton identité visuelle unique…', 50);
  const design = runDesign(brief, projectId);
  yield ev('design', 'done', `Palette propriétaire générée (seed ${design.seed.slice(0, 8)}…)`, 56, design);

  // ── Step 4.5: Architect (deterministic, from the sector blueprint) ─
  yield ev('architect', 'start', 'Planification de l’architecture…', 60);
  const plan = templateToPlan(template);
  yield ev('architect', 'done', `Structure ${template.label} planifiée`, 64, plan);

  // ── Step 5: Code — generate a complete Next.js 14 project, file by file ─
  yield ev('code', 'start', 'Génération du site Next.js production-ready…', 66);
  const coder = runCoder({
    siteId: projectId,
    idea: req.idea,
    analysis: brief,
    competitors: competitor,
    design,
    plan: req.plan ?? 'starter',
    language: {
      code: translation.detectedLanguage,
      name: translation.languageName,
      rtl: translation.isRtl,
    },
  });

  let cstep = await coder.next();
  while (!cstep.done) {
    const p = cstep.value;
    if (p.step === 'generating' && p.file) {
      const pct = 66 + Math.round((p.index / p.total) * 16); // 66 → 82
      yield ev('code', 'progress', p.file, pct, {
        step: p.step,
        file: p.file,
        progress: `${p.index}/${p.total}`,
      });
    }
    cstep = await coder.next();
  }
  const coderResult = cstep.value;
  const files: GeneratedFile[] = coderResult.generatedFiles;
  yield ev('code', 'done', `${coderResult.files.length} fichiers générés`, 84, {
    files: coderResult.files,
    path: coderResult.path,
  });

  // ── Step 6: Review (sample the key UI files to keep it fast) ───────
  yield ev('review', 'start', 'Contrôle qualité & accessibilité…', 88);
  const reviewSample = files.filter((f) => f.path.endsWith('.tsx')).slice(0, 6);
  const review = await runReviewer(reviewSample.length ? reviewSample : files);
  yield ev('review', 'done', `Score qualité : ${review.score}/100`, 92, review);

  // ── Step 7: Deploy ─────────────────────────────────────────────────
  yield ev('deploy', 'start', 'Déploiement…', 95);
  const deploy = await runDeployer(projectId, files, req.customDomain);
  yield ev('deploy', 'done', deploy.message, 100, deploy);

  return {
    id: projectId,
    path: coderResult.path,
    framework: 'next',
    brief,
    design,
    competitor,
    files,
    fileNames: coderResult.files,
    ready: coderResult.ready,
    deployUrl: deploy.url,
  };
}

function ev(
  stage: StreamEvent['stage'],
  status: StreamEvent['status'],
  message: string,
  progress: number,
  data?: unknown,
): StreamEvent {
  return { stage, status, message, progress, data };
}
