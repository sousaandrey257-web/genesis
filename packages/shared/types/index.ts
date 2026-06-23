// ─── GENESIS shared types ──────────────────────────────────────────
// Single source of truth shared between the web app and the engine.

export type SiteType =
  | 'salon'
  | 'restaurant'
  | 'ecommerce'
  | 'portfolio'
  | 'saas'
  | 'booking'
  | 'blog'
  | 'landing';

export type Tone = 'luxury' | 'playful' | 'corporate' | 'minimal' | 'bold' | 'warm';

/** Step 1 — TranslatorAgent output. */
export interface TranslationResult {
  detectedLanguage: string; // ISO code, e.g. "wo", "fr", "ar"
  languageName: string; // human label, e.g. "Wolof"
  originalText: string;
  englishText: string; // normalized brief for downstream agents
  isRtl: boolean;
}

/** Step 2 — AnalyzerAgent output. */
export interface BriefAnalysis {
  type: SiteType;
  sector: string;
  audience: string;
  tone: Tone;
  features: string[];
  location: { city?: string; country?: string; locale: string };
  businessName: string;
  valueProposition: string;
  needsAuth: boolean;
  needsPayment: boolean;
}

/** Step 3 — CompetitorAgent output. */
export interface CompetitorReport {
  competitors: Array<{
    name: string;
    url?: string;
    strengths: string[];
    weaknesses: string[];
  }>;
  topWeaknesses: string[]; // the 5 biggest gaps to exploit
  positioning: string; // how we beat them
  recommendedDifferentiators: string[];
}

/** Step 4 — DesignAgent output. A deterministic identity from a crypto seed. */
export interface DesignSystem {
  seed: string;
  palette: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    muted: string;
    border: string;
  };
  /** Ready-to-use CSS gradient string (primary → secondary). */
  gradient: string;
  fonts: { heading: string; body: string; mono: string };
  typography: {
    baseSize: string; // e.g. "16px"
    scaleRatio: number; // modular scale ratio
    headingWeight: number;
    bodyWeight: number;
  };
  spacing: {
    unit: number; // base spacing unit in px (4 or 8)
    section: string; // vertical section padding, e.g. "6rem"
  };
  radius: string;
  shadow: { sm: string; md: string; lg: string };
  spacingScale: number;
  motion: 'subtle' | 'energetic' | 'editorial';
}

/** Step 5 — a single generated file. */
export interface GeneratedFile {
  path: string;
  content: string;
}

/** Final assembled product — a complete Next.js 14 project on disk. */
export interface GeneratedSite {
  id: string;
  /** Absolute path of the generated project, e.g. /tmp/genesis/<id>. */
  path: string;
  framework: 'next' | 'static';
  brief: BriefAnalysis;
  design: DesignSystem;
  competitor: CompetitorReport;
  files: GeneratedFile[];
  /** Relative paths of every generated file. */
  fileNames: string[];
  ready: boolean;
  /** Optional static preview (only for the legacy static framework). */
  previewHtml?: string;
  deployUrl?: string;
}

/** Streamed pipeline events (SSE) from /api/generate. */
export type PipelineStage =
  | 'translate'
  | 'analyze'
  | 'competitors'
  | 'design'
  | 'architect'
  | 'code'
  | 'review'
  | 'deploy';

export interface StreamEvent {
  stage: PipelineStage;
  status: 'start' | 'progress' | 'done' | 'error';
  message: string;
  data?: unknown;
  /** 0–100 overall progress. */
  progress?: number;
}

export interface GenerateRequest {
  idea: string;
  customDomain?: string;
  clientId?: string;
  plan?: 'starter' | 'pro' | 'business' | 'enterprise' | 'agency';
}
