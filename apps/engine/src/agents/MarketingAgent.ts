import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  BriefAnalysis,
  CompetitorReport,
  DesignSystem,
  GeneratedFile,
} from '@genesis/shared';
import { askJSON } from '../llm';

// ─── Public contract ────────────────────────────────────────────────

export interface MarketingResult {
  /** Absolute root of the kit, e.g. /tmp/genesis/<siteId>/marketing */
  path: string;
  /** Every file written, path relative to marketing/. */
  files: string[];
  /** Same files with contents, for downstream review/zip/deploy. */
  generatedFiles: GeneratedFile[];
  counts: {
    instagram: number;
    facebook: number;
    linkedin: number;
    twitter: number;
    tiktok: number;
    emails: number;
  };
  /** 30-day editorial calendar (also written to calendar.json). */
  calendar: Array<{ day: number; channel: string; title: string }>;
}

export interface MarketingInput {
  siteId: string;
  analysis: BriefAnalysis;
  design: DesignSystem;
  competitors: CompetitorReport;
  language?: { code: string; name: string };
}

/**
 * Produce a complete, ready-to-use marketing kit (social posts, paid-ad copy,
 * a 7-email welcome sequence as responsive HTML, newsletter + cart templates
 * and a 30-day editorial calendar) entirely in the client's language.
 *
 * Every creative surface is written by Claude with sector-specific copywriter
 * prompts (Instagram in two batches of 15 so captions are genuinely distinct),
 * but every call has a deterministic fallback so the kit is ALWAYS complete and
 * the agent never throws as a whole. Files are written to disk under
 * /tmp/genesis/<siteId>/marketing/ and collected into GeneratedFile[].
 */
export async function runMarketing(input: MarketingInput): Promise<MarketingResult> {
  const { analysis, design, competitors } = input;
  const lang = input.language ?? {
    code: analysis.location.locale,
    name: 'the local language of the client',
  };
  const root = join('/tmp', 'genesis', input.siteId, 'marketing');
  const slug = slugify(analysis.businessName) || 'genesis-site';
  const siteUrl = `https://www.${slug}.com`;
  const hasCart = Boolean(analysis.needsPayment) || analysis.type === 'ecommerce';

  const generatedFiles: GeneratedFile[] = [];
  const emit = async (rel: string, content: string): Promise<void> => {
    const abs = join(root, rel);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content, 'utf8');
    generatedFiles.push({ path: rel, content });
  };

  // ── Fetch every creative surface in parallel (each call is fault-tolerant) ──
  const [ig1, ig2, fbPosts, liPosts, tweets, ttScripts, fbAds, gAds, emails] =
    await Promise.all([
      fetchInstagram(input, lang, slug, 1, 15),
      fetchInstagram(input, lang, slug, 16, 30),
      fetchFacebook(input, lang, siteUrl),
      fetchLinkedIn(input, lang),
      fetchTweets(input, lang),
      fetchTikTok(input, lang),
      fetchFacebookAds(input, lang),
      fetchGoogleAds(input, lang),
      fetchEmails(input, lang, siteUrl),
    ]);

  const instagram = [...ig1, ...ig2];

  // ── social/instagram → 30 posts ──
  for (const post of instagram) {
    await emit(`social/instagram/post-${pad2(post.day)}.json`, jsonFile(post));
  }

  // ── social/facebook → 10 posts ──
  for (let i = 0; i < fbPosts.length; i++) {
    await emit(`social/facebook/post-${pad2(i + 1)}.json`, jsonFile(fbPosts[i]));
  }

  // ── social/linkedin → 5 professional posts ──
  for (let i = 0; i < liPosts.length; i++) {
    await emit(`social/linkedin/post-${pad2(i + 1)}.json`, jsonFile(liPosts[i]));
  }

  // ── social/twitter → tweets.json (15) ──
  await emit('social/twitter/tweets.json', jsonFile(tweets));

  // ── social/tiktok → 5 scripts ──
  for (let i = 0; i < ttScripts.length; i++) {
    await emit(`social/tiktok/script-${pad2(i + 1)}.json`, jsonFile(ttScripts[i]));
  }

  // ── ads → facebook + google (variants + sector-aware recommendedBudget) ──
  const budget = sectorBudget(analysis, competitors);
  await emit(
    'ads/facebook-ads.json',
    jsonFile({ platform: 'Meta (Facebook/Instagram)', variants: fbAds, recommendedBudget: budget }),
  );
  await emit(
    'ads/google-ads.json',
    jsonFile({ platform: 'Google Ads (Search)', variants: gAds, recommendedBudget: budget }),
  );

  // ── emails → 7-step welcome sequence as responsive HTML ──
  let emailCount = 0;
  for (let i = 0; i < emails.welcome.length; i++) {
    const c = emails.welcome[i];
    const html = emailShell(design, {
      subject: c.subject,
      preheader: c.preheader,
      bodyHtml: emailBody(c.heading, c.paragraphs),
      ctaLabel: c.ctaLabel,
      ctaUrl: siteUrl,
    });
    await emit(`emails/welcome-sequence/email-${i + 1}.html`, html);
    emailCount++;
  }

  // ── emails → monthly newsletter template (same responsive shell) ──
  await emit(
    'emails/newsletter-template.html',
    emailShell(design, {
      subject: emails.newsletter.subject,
      preheader: emails.newsletter.intro,
      bodyHtml: newsletterBody(emails.newsletter),
      ctaLabel: emails.newsletter.ctaLabel,
      ctaUrl: siteUrl,
    }),
  );
  emailCount++;

  // ── emails → abandoned cart (only for paying / ecommerce sites) ──
  if (hasCart) {
    await emit(
      'emails/abandoned-cart.html',
      emailShell(design, {
        subject: emails.abandonedCart.subject,
        preheader: emails.abandonedCart.paragraphs[0] ?? emails.abandonedCart.subject,
        bodyHtml: emailBody(emails.abandonedCart.heading, emails.abandonedCart.paragraphs),
        ctaLabel: emails.abandonedCart.ctaLabel,
        ctaUrl: `${siteUrl}/cart`,
      }),
    );
    emailCount++;
  }

  // ── calendar.json → 30-day editorial calendar ──
  const calendar = buildCalendar(instagram, fbPosts, liPosts, tweets, ttScripts, emails, analysis);
  await emit('calendar.json', jsonFile(calendar));

  return {
    path: root,
    files: generatedFiles.map((f) => f.path),
    generatedFiles,
    counts: {
      instagram: instagram.length,
      facebook: fbPosts.length,
      linkedin: liPosts.length,
      twitter: tweets.length,
      tiktok: ttScripts.length,
      emails: emailCount,
    },
    calendar,
  };
}

// ─── Content shapes ─────────────────────────────────────────────────

interface IgPost {
  day: number;
  caption: string;
  hashtags: string[];
  visualBrief: string;
  imagePrompt: string;
}
interface FbPost {
  caption: string;
  link: string;
  visualBrief: string;
}
interface LiPost {
  title: string;
  body: string;
  hashtags: string[];
}
interface Tweet {
  text: string;
  hashtags: string[];
}
interface TtScript {
  hook: string;
  beats: string[];
  cta: string;
  soundIdea: string;
}
interface FbAd {
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  audience: string;
  dailyBudgetEUR: number;
}
interface GAd {
  headline1: string;
  headline2: string;
  headline3: string;
  description1: string;
  description2: string;
  keywords: string[];
}
interface EmailCopy {
  subject: string;
  preheader: string;
  heading: string;
  paragraphs: string[];
  ctaLabel: string;
}
interface NewsletterCopy {
  subject: string;
  heading: string;
  intro: string;
  sectionTitle: string;
  ctaLabel: string;
}
interface CartCopy {
  subject: string;
  heading: string;
  paragraphs: string[];
  ctaLabel: string;
}
interface EmailBundle {
  welcome: EmailCopy[];
  newsletter: NewsletterCopy;
  abandonedCart: CartCopy;
}

interface BudgetBlock {
  currency: 'EUR';
  testDailyEUR: number;
  recommendedDailyEUR: number;
  recommendedMonthlyEUR: number;
  channelSplitPct: { google: number; meta: number };
  rationale: string;
}

// ─── Fetchers (LLM with deterministic fallback) ─────────────────────

async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    const out = await fn();
    return out ?? fallback;
  } catch {
    return fallback;
  }
}

function businessContext(input: MarketingInput): string {
  const { analysis, competitors } = input;
  return [
    `Business: ${analysis.businessName}`,
    `Sector: ${analysis.sector}`,
    `Type: ${analysis.type}`,
    `Value proposition: ${analysis.valueProposition}`,
    `Target audience: ${analysis.audience}`,
    `Tone: ${analysis.tone}`,
    `Key features / offerings: ${analysis.features.join(', ')}`,
    `Location: ${[analysis.location.city, analysis.location.country].filter(Boolean).join(', ') || analysis.location.locale}`,
    `Differentiation vs competitors: ${competitors.positioning}`,
    `Edge to exploit: ${competitors.recommendedDifferentiators.join('; ')}`,
  ].join('\n');
}

const copySystem = (role: string, langName: string): string =>
  `You are an elite ${role} with 15 years of experience. Write punchy, specific, ` +
  `conversion-focused copy with zero clichés and zero placeholders. ` +
  `Write ALL human-readable text in ${langName}. Keep brand voice consistent.`;

async function fetchInstagram(
  input: MarketingInput,
  lang: { name: string },
  slug: string,
  from: number,
  to: number,
): Promise<IgPost[]> {
  const days = range(from, to);
  const fallback = days.map((d) => fallbackIgPost(d, input.analysis, slug));
  const data = await safe<{ posts: IgPost[] }>(
    `MarketingAgent.instagram[${from}-${to}]`,
    () =>
      askJSON<{ posts: IgPost[] }>({
        label: `MarketingAgent.instagram[${from}-${to}]`,
        maxTokens: 4000,
        system: copySystem('Instagram social-media manager', lang.name),
        user:
          `${businessContext(input)}\n\n` +
          `Create ${days.length} DISTINCT Instagram posts for days ${from} to ${to} of a 30-day plan. ` +
          `Vary angle each day (education, behind-the-scenes, social proof, offer, story, tip, FAQ, UGC prompt). ` +
          `Each caption must be unique, scroll-stopping and end with a clear call to action. ` +
          `Provide 8-15 relevant, sector-specific hashtags per post (mix broad + niche + local). ` +
          `visualBrief = art-direction note for a designer. imagePrompt = a detailed English text-to-image prompt.\n\n` +
          `Return JSON: { "posts": [{ "day": number, "caption": string, "hashtags": string[], "visualBrief": string, "imagePrompt": string }] } ` +
          `with day values exactly ${from}..${to}.`,
      }),
    { posts: fallback },
  );
  return days.map((d, i) => {
    const p = data.posts?.find((x) => x.day === d) ?? data.posts?.[i];
    return normalizeIg(p, d, input.analysis, slug);
  });
}

async function fetchFacebook(
  input: MarketingInput,
  lang: { name: string },
  siteUrl: string,
): Promise<FbPost[]> {
  const fallback = range(1, 10).map((d) => fallbackFbPost(d, input.analysis, siteUrl));
  const data = await safe<{ posts: FbPost[] }>(
    'MarketingAgent.facebook',
    () =>
      askJSON<{ posts: FbPost[] }>({
        label: 'MarketingAgent.facebook',
        maxTokens: 2600,
        system: copySystem('Facebook community manager', lang.name),
        user:
          `${businessContext(input)}\n\n` +
          `Write 10 distinct Facebook posts (longer, conversational, community-oriented). ` +
          `Each should drive a click. Use ${siteUrl} as the link.\n\n` +
          `Return JSON: { "posts": [{ "caption": string, "link": string, "visualBrief": string }] } with exactly 10 items.`,
      }),
    { posts: fallback },
  );
  return range(1, 10).map((d, i) => normalizeFb(data.posts?.[i], d, input.analysis, siteUrl));
}

async function fetchLinkedIn(input: MarketingInput, lang: { name: string }): Promise<LiPost[]> {
  const fallback = range(1, 5).map((d) => fallbackLiPost(d, input.analysis));
  const data = await safe<{ posts: LiPost[] }>(
    'MarketingAgent.linkedin',
    () =>
      askJSON<{ posts: LiPost[] }>({
        label: 'MarketingAgent.linkedin',
        maxTokens: 2600,
        system: copySystem('B2B LinkedIn thought-leadership writer', lang.name),
        user:
          `${businessContext(input)}\n\n` +
          `Write 5 professional LinkedIn posts: insightful, authoritative, value-first (no hard selling). ` +
          `Each has a strong hook title and a 3-5 short-paragraph body with a soft CTA.\n\n` +
          `Return JSON: { "posts": [{ "title": string, "body": string, "hashtags": string[] }] } with exactly 5 items.`,
      }),
    { posts: fallback },
  );
  return range(1, 5).map((d, i) => normalizeLi(data.posts?.[i], d, input.analysis));
}

async function fetchTweets(input: MarketingInput, lang: { name: string }): Promise<Tweet[]> {
  const fallback = range(1, 15).map((d) => fallbackTweet(d, input.analysis));
  const data = await safe<{ tweets: Tweet[] }>(
    'MarketingAgent.twitter',
    () =>
      askJSON<{ tweets: Tweet[] }>({
        label: 'MarketingAgent.twitter',
        maxTokens: 2200,
        system: copySystem('X/Twitter copywriter', lang.name),
        user:
          `${businessContext(input)}\n\n` +
          `Write 15 punchy tweets under 240 characters each (tips, hot takes, micro-stories, offers). ` +
          `2-3 sharp hashtags each.\n\n` +
          `Return JSON: { "tweets": [{ "text": string, "hashtags": string[] }] } with exactly 15 items.`,
      }),
    { tweets: fallback },
  );
  return range(1, 15).map((d, i) => normalizeTweet(data.tweets?.[i], d, input.analysis));
}

async function fetchTikTok(input: MarketingInput, lang: { name: string }): Promise<TtScript[]> {
  const fallback = range(1, 5).map((d) => fallbackTtScript(d, input.analysis));
  const data = await safe<{ scripts: TtScript[] }>(
    'MarketingAgent.tiktok',
    () =>
      askJSON<{ scripts: TtScript[] }>({
        label: 'MarketingAgent.tiktok',
        maxTokens: 2400,
        system: copySystem('short-form video (TikTok/Reels) scriptwriter', lang.name),
        user:
          `${businessContext(input)}\n\n` +
          `Write 5 TikTok/Reels scripts (15-30s). Each: a 3-second scroll-stopping hook, ` +
          `4-6 fast beats (shot-by-shot), a CTA, and a trending sound idea.\n\n` +
          `Return JSON: { "scripts": [{ "hook": string, "beats": string[], "cta": string, "soundIdea": string }] } with exactly 5 items.`,
      }),
    { scripts: fallback },
  );
  return range(1, 5).map((d, i) => normalizeTt(data.scripts?.[i], d, input.analysis));
}

async function fetchFacebookAds(input: MarketingInput, lang: { name: string }): Promise<FbAd[]> {
  const { analysis } = input;
  const budget = sectorBudget(analysis, input.competitors);
  const fallback = range(1, 3).map((d) => fallbackFbAd(d, analysis, budget));
  const data = await safe<{ variants: FbAd[] }>(
    'MarketingAgent.fbAds',
    () =>
      askJSON<{ variants: FbAd[] }>({
        label: 'MarketingAgent.fbAds',
        maxTokens: 2200,
        system: copySystem('Meta paid-ads media buyer & copywriter', lang.name),
        user:
          `${businessContext(input)}\n\n` +
          `Write 3 distinct Meta (Facebook/Instagram) ad variants for cold traffic. ` +
          `Each: primaryText (2-4 sentences), headline (<=40 chars), description (<=30 chars), ` +
          `cta (one of: Learn More, Shop Now, Book Now, Sign Up, Contact Us, Get Offer), ` +
          `a specific audience-targeting description, and a dailyBudgetEUR near ${budget.testDailyEUR}.\n\n` +
          `Return JSON: { "variants": [{ "primaryText": string, "headline": string, "description": string, "cta": string, "audience": string, "dailyBudgetEUR": number }] } with exactly 3 items.`,
      }),
    { variants: fallback },
  );
  return range(1, 3).map((d, i) => normalizeFbAd(data.variants?.[i], d, analysis, budget));
}

async function fetchGoogleAds(input: MarketingInput, lang: { name: string }): Promise<GAd[]> {
  const { analysis } = input;
  const fallback = range(1, 3).map((d) => fallbackGAd(d, analysis));
  const data = await safe<{ variants: GAd[] }>(
    'MarketingAgent.googleAds',
    () =>
      askJSON<{ variants: GAd[] }>({
        label: 'MarketingAgent.googleAds',
        maxTokens: 2200,
        system: copySystem('Google Search Ads specialist & copywriter', lang.name),
        user:
          `${businessContext(input)}\n\n` +
          `Write 3 Responsive Search Ad variants. Each: headline1/2/3 (each <=30 chars), ` +
          `description1/2 (each <=90 chars), and 6-10 high-intent keywords mixing the service, ` +
          `the sector and the location.\n\n` +
          `Return JSON: { "variants": [{ "headline1": string, "headline2": string, "headline3": string, "description1": string, "description2": string, "keywords": string[] }] } with exactly 3 items.`,
      }),
    { variants: fallback },
  );
  return range(1, 3).map((d, i) => normalizeGAd(data.variants?.[i], d, analysis));
}

async function fetchEmails(
  input: MarketingInput,
  lang: { name: string },
  siteUrl: string,
): Promise<EmailBundle> {
  const fallback = fallbackEmailBundle(input.analysis);
  const data = await safe<EmailBundle>(
    'MarketingAgent.emails',
    () =>
      askJSON<EmailBundle>({
        label: 'MarketingAgent.emails',
        maxTokens: 4000,
        system: copySystem('lifecycle email-marketing copywriter', lang.name),
        user:
          `${businessContext(input)}\n\n` +
          `Site URL: ${siteUrl}\n\n` +
          `Write a complete email kit:\n` +
          `1) "welcome" = a 7-email onboarding/welcome sequence. Each email: subject (compelling), ` +
          `preheader (<=90 chars), heading, paragraphs (2-4 short paragraphs), ctaLabel.\n` +
          `2) "newsletter" = a reusable monthly newsletter intro: subject, heading, intro, sectionTitle, ctaLabel.\n` +
          `3) "abandonedCart" = a cart-recovery email: subject, heading, paragraphs (2-3), ctaLabel.\n\n` +
          `Return JSON: { "welcome": [{ "subject": string, "preheader": string, "heading": string, "paragraphs": string[], "ctaLabel": string }], ` +
          `"newsletter": { "subject": string, "heading": string, "intro": string, "sectionTitle": string, "ctaLabel": string }, ` +
          `"abandonedCart": { "subject": string, "heading": string, "paragraphs": string[], "ctaLabel": string } } ` +
          `with exactly 7 welcome emails.`,
      }),
    fallback,
  );
  return normalizeEmails(data, fallback);
}

// ─── Normalizers (guarantee shape even on partial LLM output) ───────

function normalizeIg(p: Partial<IgPost> | undefined, day: number, a: BriefAnalysis, slug: string): IgPost {
  const fb = fallbackIgPost(day, a, slug);
  return {
    day,
    caption: nonEmpty(p?.caption, fb.caption),
    hashtags: cleanTags(p?.hashtags, fb.hashtags),
    visualBrief: nonEmpty(p?.visualBrief, fb.visualBrief),
    imagePrompt: nonEmpty(p?.imagePrompt, fb.imagePrompt),
  };
}

function normalizeFb(p: Partial<FbPost> | undefined, day: number, a: BriefAnalysis, url: string): FbPost {
  const fb = fallbackFbPost(day, a, url);
  return {
    caption: nonEmpty(p?.caption, fb.caption),
    link: nonEmpty(p?.link, url),
    visualBrief: nonEmpty(p?.visualBrief, fb.visualBrief),
  };
}

function normalizeLi(p: Partial<LiPost> | undefined, day: number, a: BriefAnalysis): LiPost {
  const fb = fallbackLiPost(day, a);
  return {
    title: nonEmpty(p?.title, fb.title),
    body: nonEmpty(p?.body, fb.body),
    hashtags: cleanTags(p?.hashtags, fb.hashtags),
  };
}

function normalizeTweet(p: Partial<Tweet> | undefined, day: number, a: BriefAnalysis): Tweet {
  const fb = fallbackTweet(day, a);
  return {
    text: nonEmpty(p?.text, fb.text).slice(0, 280),
    hashtags: cleanTags(p?.hashtags, fb.hashtags),
  };
}

function normalizeTt(p: Partial<TtScript> | undefined, day: number, a: BriefAnalysis): TtScript {
  const fb = fallbackTtScript(day, a);
  return {
    hook: nonEmpty(p?.hook, fb.hook),
    beats: Array.isArray(p?.beats) && p!.beats.length > 0 ? p!.beats.map(String) : fb.beats,
    cta: nonEmpty(p?.cta, fb.cta),
    soundIdea: nonEmpty(p?.soundIdea, fb.soundIdea),
  };
}

function normalizeFbAd(p: Partial<FbAd> | undefined, day: number, a: BriefAnalysis, b: BudgetBlock): FbAd {
  const fb = fallbackFbAd(day, a, b);
  return {
    primaryText: nonEmpty(p?.primaryText, fb.primaryText),
    headline: nonEmpty(p?.headline, fb.headline),
    description: nonEmpty(p?.description, fb.description),
    cta: nonEmpty(p?.cta, fb.cta),
    audience: nonEmpty(p?.audience, fb.audience),
    dailyBudgetEUR: typeof p?.dailyBudgetEUR === 'number' ? p.dailyBudgetEUR : fb.dailyBudgetEUR,
  };
}

function normalizeGAd(p: Partial<GAd> | undefined, day: number, a: BriefAnalysis): GAd {
  const fb = fallbackGAd(day, a);
  return {
    headline1: nonEmpty(p?.headline1, fb.headline1),
    headline2: nonEmpty(p?.headline2, fb.headline2),
    headline3: nonEmpty(p?.headline3, fb.headline3),
    description1: nonEmpty(p?.description1, fb.description1),
    description2: nonEmpty(p?.description2, fb.description2),
    keywords: cleanTags(p?.keywords, fb.keywords).map((k) => k.replace(/^#/, '')),
  };
}

function normalizeEmails(d: Partial<EmailBundle> | undefined, fb: EmailBundle): EmailBundle {
  const welcome = range(0, 6).map((i) => {
    const e = d?.welcome?.[i];
    const f = fb.welcome[i];
    return {
      subject: nonEmpty(e?.subject, f.subject),
      preheader: nonEmpty(e?.preheader, f.preheader),
      heading: nonEmpty(e?.heading, f.heading),
      paragraphs:
        Array.isArray(e?.paragraphs) && e!.paragraphs.length > 0
          ? e!.paragraphs.map(String)
          : f.paragraphs,
      ctaLabel: nonEmpty(e?.ctaLabel, f.ctaLabel),
    };
  });
  const n = d?.newsletter;
  const c = d?.abandonedCart;
  return {
    welcome,
    newsletter: {
      subject: nonEmpty(n?.subject, fb.newsletter.subject),
      heading: nonEmpty(n?.heading, fb.newsletter.heading),
      intro: nonEmpty(n?.intro, fb.newsletter.intro),
      sectionTitle: nonEmpty(n?.sectionTitle, fb.newsletter.sectionTitle),
      ctaLabel: nonEmpty(n?.ctaLabel, fb.newsletter.ctaLabel),
    },
    abandonedCart: {
      subject: nonEmpty(c?.subject, fb.abandonedCart.subject),
      heading: nonEmpty(c?.heading, fb.abandonedCart.heading),
      paragraphs:
        Array.isArray(c?.paragraphs) && c!.paragraphs.length > 0
          ? c!.paragraphs.map(String)
          : fb.abandonedCart.paragraphs,
      ctaLabel: nonEmpty(c?.ctaLabel, fb.abandonedCart.ctaLabel),
    },
  };
}

// ─── Deterministic fallbacks ────────────────────────────────────────

function fallbackIgPost(day: number, a: BriefAnalysis, slug: string): IgPost {
  const feature = pick(a.features, day);
  const angles = [
    `Discover how ${a.businessName} makes ${feature.toLowerCase()} effortless.`,
    `Behind the scenes at ${a.businessName}: ${a.valueProposition}`,
    `Why ${a.audience} choose ${a.businessName} for ${feature.toLowerCase()}.`,
    `Quick tip: get more from ${feature.toLowerCase()} with ${a.businessName}.`,
    `Real results, real people. ${a.businessName} delivers ${a.valueProposition.toLowerCase()}.`,
  ];
  const caption = `${pick(angles, day)} 👉 Save this post and book today.`;
  return {
    day,
    caption,
    hashtags: sectorHashtags(a, slug),
    visualBrief: `Bright, on-brand photo highlighting "${feature}", with the ${a.businessName} logo subtly placed.`,
    imagePrompt: `Professional ${a.sector} photograph showcasing ${feature}, warm natural lighting, clean composition, modern aesthetic, high detail, brand-consistent color accents`,
  };
}

function fallbackFbPost(day: number, a: BriefAnalysis, url: string): FbPost {
  const feature = pick(a.features, day);
  return {
    caption:
      `At ${a.businessName}, we believe ${a.audience} deserve the best when it comes to ${feature.toLowerCase()}. ` +
      `${a.valueProposition} That's the promise behind everything we do. ` +
      `Curious to see how we can help you? Learn more on our site.`,
    link: url,
    visualBrief: `Lifestyle image of a happy customer engaging with "${feature}", warm and inviting tone.`,
  };
}

function fallbackLiPost(day: number, a: BriefAnalysis): LiPost {
  const feature = pick(a.features, day);
  return {
    title: `What ${a.sector} gets wrong about ${feature.toLowerCase()} — and how we fixed it`,
    body:
      `In ${a.sector}, ${feature.toLowerCase()} is too often treated as an afterthought.\n\n` +
      `At ${a.businessName}, we took a different approach: ${a.valueProposition}\n\n` +
      `The result is a better experience for ${a.audience}, built on consistency and care.\n\n` +
      `If this resonates, let's connect — I'm always happy to share what we've learned.`,
    hashtags: sectorHashtags(a, slugify(a.businessName)).slice(0, 5),
  };
}

function fallbackTweet(day: number, a: BriefAnalysis): Tweet {
  const feature = pick(a.features, day);
  const lines = [
    `${a.valueProposition} That's ${a.businessName} in one line.`,
    `Stop settling for average ${feature.toLowerCase()}. ${a.businessName} raises the bar.`,
    `${a.audience}: you deserve better. ${a.businessName} delivers.`,
    `Small detail, big difference: how we approach ${feature.toLowerCase()}.`,
    `One question we hear a lot: "Why ${a.businessName}?" The answer: ${a.valueProposition.toLowerCase()}`,
  ];
  return { text: pick(lines, day), hashtags: sectorHashtags(a, slugify(a.businessName)).slice(0, 3) };
}

function fallbackTtScript(day: number, a: BriefAnalysis): TtScript {
  const feature = pick(a.features, day);
  return {
    hook: `POV: you finally found the right ${a.sector} for ${feature.toLowerCase()} 👀`,
    beats: [
      `Open on a relatable problem ${a.audience} face every day.`,
      `Quick cut to ${a.businessName} solving it with ${feature.toLowerCase()}.`,
      `Show the transformation / result up close.`,
      `Flash a happy customer reaction.`,
      `End on the logo with the tagline: ${a.valueProposition}.`,
    ],
    cta: `Tap the link in bio to get started with ${a.businessName}.`,
    soundIdea: `A trending upbeat audio with a satisfying beat drop on the reveal.`,
  };
}

function fallbackFbAd(day: number, a: BriefAnalysis, b: BudgetBlock): FbAd {
  const ctas = ['Learn More', 'Book Now', 'Get Offer'];
  return {
    primaryText:
      `Looking for ${a.sector} you can trust? ${a.businessName} offers ${a.valueProposition.toLowerCase()} ` +
      `Join the ${a.audience} who already made the switch. Tap to discover more.`,
    headline: truncate(`${a.businessName}: ${pick(a.features, day)}`, 40),
    description: truncate(a.valueProposition, 30),
    cta: pick(ctas, day),
    audience: `${a.audience} interested in ${a.sector}${a.location.city ? `, near ${a.location.city}` : ''}, aged 25-55.`,
    dailyBudgetEUR: b.testDailyEUR,
  };
}

function fallbackGAd(day: number, a: BriefAnalysis): GAd {
  const city = a.location.city ?? a.location.country ?? '';
  return {
    headline1: truncate(a.businessName, 30),
    headline2: truncate(pick(a.features, day), 30),
    headline3: truncate(city ? `${a.sector} in ${city}` : a.sector, 30),
    description1: truncate(`${a.valueProposition} Trusted by ${a.audience}.`, 90),
    description2: truncate(`Discover ${a.businessName} today and see the difference. Get started now.`, 90),
    keywords: dedupe([
      a.sector.toLowerCase(),
      `${a.sector.toLowerCase()} ${city}`.trim(),
      a.businessName.toLowerCase(),
      ...a.features.slice(0, 4).map((f) => f.toLowerCase()),
      `best ${a.sector.toLowerCase()}`,
    ]).filter(Boolean),
  };
}

function fallbackEmailBundle(a: BriefAnalysis): EmailBundle {
  const welcome: EmailCopy[] = [
    {
      subject: `Welcome to ${a.businessName} 👋`,
      preheader: `We're thrilled to have you. Here's what's next.`,
      heading: `Welcome aboard!`,
      paragraphs: [
        `Hi there, and welcome to ${a.businessName}. We're genuinely glad you're here.`,
        `${a.valueProposition} Over the next few days, we'll show you exactly how we can help.`,
      ],
      ctaLabel: 'Explore now',
    },
    {
      subject: `Here's what makes ${a.businessName} different`,
      preheader: `The story behind what we do.`,
      heading: `Why we do this`,
      paragraphs: [
        `Most ${a.sector} options feel the same. We built ${a.businessName} to change that.`,
        `For ${a.audience}, we focus on what truly matters: ${a.features.slice(0, 3).join(', ')}.`,
      ],
      ctaLabel: 'See how it works',
    },
    {
      subject: `${pick(a.features, 0)} — made simple`,
      preheader: `A closer look at what you get.`,
      heading: `Built around you`,
      paragraphs: [
        `Today, let's talk about ${pick(a.features, 0).toLowerCase()}.`,
        `It's one of the reasons ${a.audience} keep choosing ${a.businessName}.`,
      ],
      ctaLabel: 'Discover more',
    },
    {
      subject: `What our customers say`,
      preheader: `Real stories from people like you.`,
      heading: `You're in good company`,
      paragraphs: [
        `Don't just take our word for it — our customers love what we do.`,
        `Join the community of ${a.audience} who trust ${a.businessName} every day.`,
      ],
      ctaLabel: 'Read their stories',
    },
    {
      subject: `A little something for you 🎁`,
      preheader: `Because you're part of the family.`,
      heading: `An exclusive welcome offer`,
      paragraphs: [
        `As a thank-you for joining, here's a special offer just for new members.`,
        `Ready to experience ${a.businessName} for yourself? There's no better time.`,
      ],
      ctaLabel: 'Claim your offer',
    },
    {
      subject: `Got questions? We've got answers`,
      preheader: `Everything you need to know.`,
      heading: `We're here to help`,
      paragraphs: [
        `Starting something new always raises questions — that's completely normal.`,
        `Our team is one click away whenever you need us. Just reply to this email.`,
      ],
      ctaLabel: 'Get in touch',
    },
    {
      subject: `Ready when you are`,
      preheader: `Let's make it happen together.`,
      heading: `Let's get started`,
      paragraphs: [
        `You've seen what ${a.businessName} is all about. Now it's your move.`,
        `${a.valueProposition} We can't wait to welcome you in.`,
      ],
      ctaLabel: 'Get started',
    },
  ];
  return {
    welcome,
    newsletter: {
      subject: `${a.businessName} — what's new this month`,
      heading: `This month at ${a.businessName}`,
      intro: `Here's a quick roundup of news, tips and offers from ${a.businessName}.`,
      sectionTitle: 'Highlights',
      ctaLabel: 'Read more',
    },
    abandonedCart: {
      subject: `You left something behind 🛒`,
      heading: `Still thinking it over?`,
      paragraphs: [
        `We noticed you didn't quite finish your order at ${a.businessName}.`,
        `Your items are still waiting for you — complete your purchase before they're gone.`,
      ],
      ctaLabel: 'Complete my order',
    },
  };
}

// ─── Sector-aware ad budget ─────────────────────────────────────────

function sectorBudget(a: BriefAnalysis, c: CompetitorReport): BudgetBlock {
  const s = `${a.sector} ${a.type} ${c.positioning}`.toLowerCase();
  let test = 15;
  let google = 50;
  if (/saas|software|tech|b2b|agency|consult|finance|insurance|legal|law|avocat/.test(s)) {
    test = 40;
    google = 65;
  } else if (/ecommerce|retail|shop|boutique|store|fashion|cosmet/.test(s)) {
    test = 30;
    google = 40;
  } else if (/immobil|real estate|medical|health|clinic|dentist|auto|construction/.test(s)) {
    test = 35;
    google = 60;
  } else if (/restaur|salon|beauty|coiff|food|cafe|hotel|local|fitness|gym/.test(s)) {
    test = 18;
    google = 45;
  }
  if (a.needsPayment) test += 5;
  const recommendedDaily = Math.round(test * 2);
  return {
    currency: 'EUR',
    testDailyEUR: test,
    recommendedDailyEUR: recommendedDaily,
    recommendedMonthlyEUR: recommendedDaily * 30,
    channelSplitPct: { google, meta: 100 - google },
    rationale:
      `For ${a.sector} targeting ${a.audience}, start with a €${test}/day test budget per platform to gather data, ` +
      `then scale winners to ~€${recommendedDaily}/day. A ${google}/${100 - google} Google/Meta split fits this sector's ` +
      `intent profile; reallocate toward whichever channel returns the best cost-per-result after two weeks.`,
  };
}

// ─── Responsive HTML email shell ────────────────────────────────────

function emailShell(
  design: DesignSystem,
  opts: { subject: string; preheader: string; bodyHtml: string; ctaLabel: string; ctaUrl: string },
): string {
  const p = design.palette;
  const gradient = design.gradient || `linear-gradient(135deg, ${p.primary}, ${p.secondary})`;
  const heading = design.fonts.heading || 'Helvetica, Arial, sans-serif';
  const body = design.fonts.body || 'Helvetica, Arial, sans-serif';
  return `<!-- Subject: ${escapeHtml(opts.subject)} -->
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(opts.subject)}</title>
  <style>
    body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; }
    img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    a { text-decoration: none; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .px { padding-left: 24px !important; padding-right: 24px !important; }
      .btn { display: block !important; width: 100% !important; box-sizing: border-box; text-align: center; }
      h1 { font-size: 24px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:${p.background}; font-family:'${body}', Helvetica, Arial, sans-serif; color:${p.text};">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${escapeHtml(opts.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${p.background};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:600px; background-color:${p.surface}; border-radius:${design.radius || '12px'}; overflow:hidden; border:1px solid ${p.border};">
          <tr>
            <td style="background-image:${gradient}; background-color:${p.primary}; padding:32px 40px; text-align:center;">
              <span style="font-family:'${heading}', Helvetica, Arial, sans-serif; font-size:22px; font-weight:${design.typography.headingWeight}; color:#ffffff; letter-spacing:0.5px;">${escapeHtml(opts.subject)}</span>
            </td>
          </tr>
          <tr>
            <td class="px" style="padding:40px;">
              ${opts.bodyHtml}
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:32px auto 8px;">
                <tr>
                  <td align="center" style="background-image:${gradient}; background-color:${p.primary}; border-radius:${design.radius || '8px'};">
                    <a class="btn" href="${escapeHtml(opts.ctaUrl)}" target="_blank" style="display:inline-block; padding:14px 36px; font-family:'${heading}', Helvetica, Arial, sans-serif; font-size:16px; font-weight:600; color:#ffffff;">${escapeHtml(opts.ctaLabel)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px; border-top:1px solid ${p.border}; text-align:center;">
              <p style="margin:0 0 8px; font-size:12px; color:${p.muted};">You are receiving this email because you subscribed.</p>
              <p style="margin:0; font-size:12px; color:${p.muted};"><a href="${escapeHtml(opts.ctaUrl)}/unsubscribe" style="color:${p.muted}; text-decoration:underline;">Unsubscribe</a> &nbsp;·&nbsp; <a href="${escapeHtml(opts.ctaUrl)}" style="color:${p.muted}; text-decoration:underline;">Visit website</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

function emailBody(heading: string, paragraphs: string[]): string {
  const ps = paragraphs
    .map(
      (t) =>
        `<p style="margin:0 0 16px; font-size:16px; line-height:1.6;">${escapeHtml(t)}</p>`,
    )
    .join('\n              ');
  return `<h1 style="margin:0 0 20px; font-size:26px; line-height:1.3;">${escapeHtml(heading)}</h1>
              ${ps}`;
}

function newsletterBody(n: NewsletterCopy): string {
  return `<h1 style="margin:0 0 16px; font-size:26px; line-height:1.3;">${escapeHtml(n.heading)}</h1>
              <p style="margin:0 0 24px; font-size:16px; line-height:1.6;">${escapeHtml(n.intro)}</p>
              <h2 style="margin:0 0 12px; font-size:18px;">${escapeHtml(n.sectionTitle)}</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:12px 0; border-top:1px solid #eee;"><strong>{{ARTICLE_1_TITLE}}</strong><br/><span style="font-size:15px; line-height:1.6;">{{ARTICLE_1_EXCERPT}}</span></td></tr>
                <tr><td style="padding:12px 0; border-top:1px solid #eee;"><strong>{{ARTICLE_2_TITLE}}</strong><br/><span style="font-size:15px; line-height:1.6;">{{ARTICLE_2_EXCERPT}}</span></td></tr>
                <tr><td style="padding:12px 0; border-top:1px solid #eee;"><strong>{{ARTICLE_3_TITLE}}</strong><br/><span style="font-size:15px; line-height:1.6;">{{ARTICLE_3_EXCERPT}}</span></td></tr>
              </table>`;
}

// ─── 30-day editorial calendar ──────────────────────────────────────

function buildCalendar(
  ig: IgPost[],
  fb: FbPost[],
  li: LiPost[],
  tw: Tweet[],
  tt: TtScript[],
  emails: EmailBundle,
  a: BriefAnalysis,
): Array<{ day: number; channel: string; title: string }> {
  const wheel: Array<'instagram' | 'facebook' | 'linkedin' | 'twitter' | 'tiktok' | 'email'> = [
    'instagram',
    'twitter',
    'facebook',
    'instagram',
    'tiktok',
    'linkedin',
    'email',
  ];
  return range(1, 30).map((day) => {
    const channel = wheel[(day - 1) % wheel.length];
    let title: string;
    switch (channel) {
      case 'instagram':
        title = shortTitle(ig[(day - 1) % ig.length]?.caption);
        break;
      case 'facebook':
        title = shortTitle(fb[(day - 1) % fb.length]?.caption);
        break;
      case 'linkedin':
        title = li[(day - 1) % li.length]?.title ?? `Thought leadership: ${a.sector}`;
        break;
      case 'twitter':
        title = shortTitle(tw[(day - 1) % tw.length]?.text);
        break;
      case 'tiktok':
        title = shortTitle(tt[(day - 1) % tt.length]?.hook);
        break;
      default:
        title = emails.welcome[(day - 1) % emails.welcome.length]?.subject ?? emails.newsletter.subject;
    }
    return { day, channel, title };
  });
}

// ─── Small utilities ────────────────────────────────────────────────

function jsonFile(v: unknown): string {
  return JSON.stringify(v, null, 2) + '\n';
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
}

function pick<T>(arr: T[], seed: number): T {
  if (arr.length === 0) return '' as unknown as T;
  return arr[Math.abs(seed) % arr.length];
}

function nonEmpty(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : fallback;
}

function cleanTags(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  const tags = v
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    .map((t) => {
      const clean = t.trim().replace(/\s+/g, '');
      return clean.startsWith('#') ? clean : `#${clean}`;
    });
  return tags.length > 0 ? dedupe(tags) : fallback;
}

function sectorHashtags(a: BriefAnalysis, slug: string): string[] {
  const tag = (s: string): string => `#${s.replace(/[^a-zA-Z0-9]/g, '')}`;
  const city = a.location.city ?? a.location.country ?? '';
  return dedupe(
    [
      tag(slug),
      tag(a.sector),
      tag(a.type),
      ...a.features.slice(0, 4).map(tag),
      city ? tag(city) : '',
      '#smallbusiness',
      '#quality',
    ].filter((t) => t.length > 1),
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
}

function shortTitle(s: string | undefined): string {
  if (!s) return 'Post';
  const firstLine = s.split('\n')[0].replace(/[#@].*/g, '').trim();
  return truncate(firstLine || s.trim(), 70);
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
