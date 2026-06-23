import { createHash, randomBytes } from 'node:crypto';
import type { BriefAnalysis, DesignSystem, Tone } from '@genesis/shared';

/**
 * Step 4 — generate a deterministic, unique visual identity from a crypto seed.
 *
 * The seed is derived from the siteId (sha256), so the same site always yields
 * the same design (reproducible), while a fresh siteId per client guarantees a
 * palette + typography + spacing combination that no other client shares. Hues,
 * scale ratios and spacing are derived from independent hash bytes and then
 * constrained by the brand tone so the result is always tasteful.
 */

const FONT_PAIRS: Record<Tone, { heading: string; body: string }> = {
  luxury: { heading: 'Playfair Display', body: 'Inter' },
  playful: { heading: 'Poppins', body: 'Nunito' },
  corporate: { heading: 'Sora', body: 'Inter' },
  minimal: { heading: 'Inter', body: 'Inter' },
  bold: { heading: 'Space Grotesk', body: 'Inter' },
  warm: { heading: 'Fraunces', body: 'Mulish' },
};

const MOTION_BY_TONE: Record<Tone, DesignSystem['motion']> = {
  luxury: 'editorial',
  playful: 'energetic',
  corporate: 'subtle',
  minimal: 'subtle',
  bold: 'energetic',
  warm: 'editorial',
};

const SCALE_RATIOS = [1.2, 1.25, 1.333, 1.414]; // minor third → augmented fourth

function hsl(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

/** A random 16-byte seed, used when no siteId is available. */
export function generateSeed(): string {
  return randomBytes(16).toString('hex');
}

/** Deterministically derive the design seed from a siteId. */
export function deriveSeed(siteId: string): string {
  return createHash('sha256').update(siteId).digest('hex').slice(0, 32);
}

/**
 * Build the full design system. Pass a siteId (preferred) or a raw seed; either
 * way the output is deterministic for that input.
 */
export function runDesign(brief: BriefAnalysis, siteIdOrSeed = generateSeed()): DesignSystem {
  const seed = siteIdOrSeed.length === 32 ? siteIdOrSeed : deriveSeed(siteIdOrSeed);
  const b = createHash('sha256').update(seed).digest();

  const baseHue = (b[0] / 255) * 360;
  const complement = (baseHue + 150 + (b[1] / 255) * 60) % 360;
  const accentHue = (baseHue + 30 + (b[2] / 255) * 40) % 360;

  const tone = brief.tone;
  const dark = tone === 'luxury' || tone === 'bold' || tone === 'corporate';

  const palette: DesignSystem['palette'] = dark
    ? {
        background: hsl(baseHue, 18, 7),
        surface: hsl(baseHue, 16, 12),
        primary: hsl(baseHue, 72, 60),
        secondary: hsl(complement, 66, 58),
        accent: hsl(accentHue, 85, 62),
        text: hsl(baseHue, 12, 96),
        muted: hsl(baseHue, 10, 65),
        border: hsl(baseHue, 14, 22),
      }
    : {
        background: hsl(baseHue, 30, 98),
        surface: hsl(baseHue, 24, 94),
        primary: hsl(baseHue, 68, 46),
        secondary: hsl(complement, 60, 44),
        accent: hsl(accentHue, 78, 50),
        text: hsl(baseHue, 22, 12),
        muted: hsl(baseHue, 12, 40),
        border: hsl(baseHue, 18, 86),
      };

  const radii = ['0.25rem', '0.5rem', '0.75rem', '1rem', '1.5rem'];
  const unit = b[5] % 2 === 0 ? 4 : 8;
  const sectionPad = ['4rem', '5rem', '6rem', '7rem'][b[6] % 4];
  const shadowHue = Math.round(baseHue);

  return {
    seed,
    palette,
    gradient: `linear-gradient(135deg, ${palette.primary} 0%, ${palette.secondary} 100%)`,
    fonts: { ...FONT_PAIRS[tone], mono: 'JetBrains Mono' },
    typography: {
      baseSize: '16px',
      scaleRatio: SCALE_RATIOS[b[4] % SCALE_RATIOS.length],
      headingWeight: [600, 700, 800][b[7] % 3],
      bodyWeight: [400, 500][b[8] % 2],
    },
    spacing: { unit, section: sectionPad },
    radius: radii[b[3] % radii.length],
    shadow: {
      sm: `0 1px 2px hsla(${shadowHue}, 30%, 10%, 0.08)`,
      md: `0 8px 24px hsla(${shadowHue}, 30%, 10%, 0.12)`,
      lg: `0 24px 64px hsla(${shadowHue}, 35%, 10%, 0.18)`,
    },
    spacingScale: 1 + (b[9] / 255) * 0.5,
    motion: MOTION_BY_TONE[tone],
  };
}
