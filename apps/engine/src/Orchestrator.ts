import type {
  GenerateRequest,
  GeneratedFile,
  GeneratedSite,
  StreamEvent,
  CompetitorReport,
  BriefAnalysis,
} from '@genesis/shared';
import { runTranslator } from './agents/TranslatorAgent';
import { runAnalyzer } from './agents/AnalyzerAgent';
import { runCompetitor } from './agents/CompetitorAgent';
import { runContent } from './agents/ContentAgent';
import { runSEO } from './agents/SEOAgent';
import { runDesign, generateSeed } from './agents/DesignAgent';
import { runCoder } from './agents/CoderAgent';
import { runMobile } from './agents/MobileAgent';
import { runVideo } from './agents/VideoAgent';
import { runMarketing } from './agents/MarketingAgent';
import { runGrowth } from './agents/GrowthAgent';
import { runBrand } from './agents/BrandAgent';
import { getSectorInsights, recordLearning } from './agents/LearningAgent';
import { predictRevenue } from './agents/RevenueAgent';
import { getTemplate, applyTemplateToBrief, templateToPlan } from './templates';
import { runReviewer } from './agents/ReviewerAgent';
import { runDeployer } from './agents/DeployerAgent';
import { validateProject } from './validate';

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
    24,
    { brief, template: template.label },
  );

  // ── Step 2.5: Learning — consult winning patterns for this sector ──
  yield ev('learning', 'start', 'Consultation des apprentissages du secteur…', 26, undefined, 2.5, 'LearningAgent');
  const insights = await getSectorInsights(brief.sector).catch(() => undefined);
  yield ev(
    'learning',
    'done',
    insights && insights.sampleSize > 0
      ? `${insights.sampleSize} sites analysés — ${insights.patterns.length} patterns gagnants`
      : 'Patterns secteur par défaut (base en cours de constitution)',
    28,
    insights,
    2.5,
    'LearningAgent',
  );

  // ── Step 2.6: Revenue — project the revenue before generating ─────
  yield ev('revenue', 'start', 'Prédiction du chiffre d’affaires…', 30, undefined, 0.5, 'RevenueAgent');
  const revenue = await predictRevenue({ analysis: brief, insights }).catch(() => undefined);
  yield ev(
    'revenue',
    revenue ? 'done' : 'error',
    revenue
      ? `CA année 1 estimé : ${Math.round(revenue.revenueYear1).toLocaleString('fr-FR')} € (confiance ${Math.round(revenue.confidence * 100)}%)`
      : 'Prédiction indisponible',
    32,
    revenue,
    0.5,
    'RevenueAgent',
  );

  // ── Step 3: Competitors (non-fatal: degrade to a neutral positioning) ─
  yield ev('competitors', 'start', 'Analyse de 20 concurrents…', 34);
  let competitor: CompetitorReport;
  try {
    competitor = await runCompetitor(brief);
    yield ev(
      'competitors',
      'done',
      `Positionnement gagnant identifié (${competitor.topWeaknesses.length} faiblesses exploitées)`,
      40,
      competitor,
    );
  } catch (err) {
    competitor = fallbackCompetitor(brief);
    yield ev('competitors', 'error', `Analyse concurrentielle indisponible (${msg(err)}) — positionnement par défaut`, 40);
  }

  // ── Step 3.5: Content + SEO (parallel; non-fatal — Coder has fallbacks) ─
  yield ev('content', 'start', 'Rédaction de la copy et du SEO localisés…', 44);
  const [content, seo] = await Promise.all([
    runContent(brief, translation).catch(() => undefined),
    runSEO(brief, translation).catch(() => undefined),
  ]);
  yield ev(
    'content',
    content || seo ? 'done' : 'error',
    content && seo
      ? 'Copy persuasive + SEO générés'
      : content
        ? 'Copy générée (SEO par défaut)'
        : seo
          ? 'SEO généré (copy par défaut)'
          : 'Copy/SEO indisponibles — valeurs par défaut',
    48,
    { hasContent: Boolean(content), hasSeo: Boolean(seo) },
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
    content,
    seo,
    learnings: insights?.briefAugmentation,
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

  // Validate the project before declaring it done (catches truncated files,
  // leaked markdown fences, missing entrypoints) and surface any warnings.
  const validation = validateProject(files);
  yield ev(
    'code',
    validation.ok ? 'done' : 'error',
    validation.ok
      ? `${coderResult.files.length} fichiers générés et validés`
      : `${coderResult.files.length} fichiers générés — ${validation.errors.length} problème(s) détecté(s)`,
    82,
    { files: coderResult.files, path: coderResult.path, validation },
  );

  const lang = {
    code: translation.detectedLanguage,
    name: translation.languageName,
    rtl: translation.isRtl,
  };

  // ── Steps 5.5–8: Brand, mobile app, promo videos, marketing kit (parallel; non-fatal) ─
  yield ev('brand', 'start', 'Création de l’identité visuelle (logo, charte)…', 83, undefined, 5.5, 'BrandAgent');
  yield ev('mobile', 'start', 'Génération de l’app mobile (Expo)…', 83, undefined, 6, 'MobileAgent');
  yield ev('video', 'start', 'Génération des vidéos de présentation…', 84, undefined, 7, 'VideoAgent');
  yield ev('marketing', 'start', 'Génération du kit marketing (social, ads, emails)…', 85, undefined, 8, 'MarketingAgent');

  const [brandR, mobileR, videoR, marketingR] = await Promise.allSettled([
    runBrand({ siteId: projectId, analysis: brief, design, language: { code: lang.code, name: lang.name } }),
    runMobile({ siteId: projectId, analysis: brief, design, competitors: competitor, language: lang }),
    runVideo({ siteId: projectId, analysis: brief, design, competitors: competitor, language: lang }),
    runMarketing({ siteId: projectId, analysis: brief, design, competitors: competitor, language: lang }),
  ]);

  const brand = brandR.status === 'fulfilled' ? brandR.value : undefined;
  yield brand
    ? ev('brand', 'done', brand.note, 86, brand, 5.5, 'BrandAgent')
    : ev('brand', 'error', `Identité visuelle indisponible (${msg((brandR as PromiseRejectedResult).reason)})`, 86, undefined, 5.5, 'BrandAgent');

  const mobile = mobileR.status === 'fulfilled' ? mobileR.value : undefined;
  yield mobile
    ? ev('mobile', 'done', `App mobile générée (${mobile.files.length} fichiers, EAS-ready)`, 86, mobile, 6, 'MobileAgent')
    : ev('mobile', 'error', `App mobile indisponible (${msg((mobileR as PromiseRejectedResult).reason)})`, 86, undefined, 6, 'MobileAgent');

  const video = videoR.status === 'fulfilled' ? videoR.value : undefined;
  yield video
    ? ev('video', 'done', video.note, 87, video, 7, 'VideoAgent')
    : ev('video', 'error', `Vidéos indisponibles (${msg((videoR as PromiseRejectedResult).reason)})`, 87, undefined, 7, 'VideoAgent');

  const marketing = marketingR.status === 'fulfilled' ? marketingR.value : undefined;
  yield marketing
    ? ev('marketing', 'done', `Kit marketing généré (${marketing.files.length} fichiers)`, 88, marketing, 8, 'MarketingAgent')
    : ev('marketing', 'error', `Kit marketing indisponible (${msg((marketingR as PromiseRejectedResult).reason)})`, 88, undefined, 8, 'MarketingAgent');

  // ── Step 9: Review (sample the key UI files to keep it fast) ───────
  yield ev('review', 'start', 'Contrôle qualité & accessibilité…', 89, undefined, 9, 'ReviewerAgent');
  let review: Awaited<ReturnType<typeof runReviewer>>;
  try {
    const reviewSample = files.filter((f) => f.path.endsWith('.tsx')).slice(0, 6);
    review = await runReviewer(reviewSample.length ? reviewSample : files);
    yield ev('review', 'done', `Score qualité : ${review.score}/100`, 91, review, 9, 'ReviewerAgent');
  } catch (err) {
    review = { score: 0, issues: [], passed: false } as typeof review;
    yield ev('review', 'error', `Revue indisponible (${msg(err)}) — étape ignorée`, 91, undefined, 9, 'ReviewerAgent');
  }

  // ── Step 11: Growth — inject analytics + A/B test into the site (non-fatal) ─
  yield ev('growth', 'start', 'Intégration analytics & A/B testing…', 93, undefined, 11, 'GrowthAgent');
  let growth: ReturnType<typeof runGrowth> | undefined;
  try {
    growth = runGrowth({ analysis: brief, design });
    files.push(...growth.files); // analytics ships with the site
    yield ev('growth', 'done', `Analytics + A/B test prêts (${growth.files.length} fichiers injectés)`, 94, growth, 11, 'GrowthAgent');
  } catch (err) {
    yield ev('growth', 'error', `Growth indisponible (${msg(err)})`, 94, undefined, 11, 'GrowthAgent');
  }

  // ── Step 12: Deploy ────────────────────────────────────────────────
  yield ev('deploy', 'start', 'Déploiement…', 95, undefined, 12, 'DeployerAgent');
  const deploy = await runDeployer(projectId, files, req.customDomain);
  yield ev('deploy', 'done', deploy.message, 98, deploy, 12, 'DeployerAgent');

  // ── Step 13: Learning — persist what we learned for the next generations ─
  yield ev('learning', 'start', 'Mémorisation des apprentissages…', 99, undefined, 13, 'LearningAgent');
  const learning = await recordLearning({
    siteId: projectId,
    sector: brief.sector,
    designTokens: design.palette as unknown as Record<string, unknown>,
    qualityScore: review.score,
    whatWorked: insights?.patterns,
  }).catch((err) => ({ saved: false, note: msg(err) }));
  yield ev('learning', 'done', learning.saved ? 'Apprentissage sauvegardé' : learning.note, 100, learning, 13, 'LearningAgent');

  return {
    id: projectId,
    path: coderResult.path,
    framework: 'next',
    brief,
    design,
    competitor,
    files,
    fileNames: files.map((f) => f.path),
    ready: coderResult.ready,
    deployUrl: deploy.url,
    mobile: mobile
      ? { path: mobile.path, fileNames: mobile.files, ready: mobile.ready }
      : undefined,
    video: video
      ? { path: video.path, outputs: video.outputs, rendered: video.rendered, note: video.note }
      : undefined,
    marketing: marketing
      ? { path: marketing.path, counts: marketing.counts, calendar: marketing.calendar }
      : undefined,
    growth: growth
      ? { abTestId: growth.abTest.id, recommendations: growth.recommendations }
      : undefined,
    brand: brand
      ? { path: brand.path, logos: brand.logos, rendered: brand.rendered, note: brand.note }
      : undefined,
    revenue: revenue
      ? {
          revenueMonth1: revenue.revenueMonth1,
          revenueYear1: revenue.revenueYear1,
          confidence: revenue.confidence,
          breakEvenMonths: revenue.breakEvenMonths,
        }
      : undefined,
    learning,
  };
}

function ev(
  stage: StreamEvent['stage'],
  status: StreamEvent['status'],
  message: string,
  progress: number,
  data?: unknown,
  step?: number,
  agent?: string,
): StreamEvent {
  return { stage, status, message, progress, data, step, agent };
}

function msg(err: unknown): string {
  return (err as Error)?.message ?? String(err);
}

/** Neutral competitor report so the pipeline survives a CompetitorAgent failure. */
function fallbackCompetitor(brief: BriefAnalysis): CompetitorReport {
  return {
    competitors: [],
    topWeaknesses: [],
    positioning: `un positionnement premium et clair pour ${brief.sector}`,
    recommendedDifferentiators: brief.features.slice(0, 3),
  };
}
