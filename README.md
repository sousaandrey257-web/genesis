# GENESIS

> Décris ton idée → site web ou SaaS unique, déployé, multilingue.

A monorepo with a premium Next.js landing page and an autonomous generation
engine that turns one line of text into a deployed website.

## Quickstart

```bash
cp .env.example .env        # add at least ANTHROPIC_API_KEY
npm install
npm run dev                 # → http://localhost:3000
```

- Landing page: `http://localhost:3000`
- Generate a site live: `http://localhost:3000/generate`
- Dashboard shell: `http://localhost:3000/dashboard`

Run the engine straight from the terminal:

```bash
npm run engine -- "Salon de coiffure haut de gamme à Lyon"
# writes files to apps/engine/generated-sites/<id>/
```

## How it works — the 7-step pipeline

| Step | Agent | What it does |
|------|-------|--------------|
| 1 | `TranslatorAgent` | Detects language (50+, incl. Wolof, Bambara, Lingala, Swahili) → English brief |
| 2 | `AnalyzerAgent` | Type, sector, audience, tone, features, location, auth/payment |
| 3 | `CompetitorAgent` | Surveys competitors, finds their 5 biggest weaknesses, sets positioning |
| 4 | `DesignAgent` | **Deterministic crypto seed → unique palette** (no two clients alike) |
| 4.5 | `ArchitectAgent` | Plans the file set |
| 5 | `CoderAgent` | `claude-sonnet-4-6`, 8000 tok/file, streamed, production-ready + chatbot |
| 6 | `ReviewerAgent` | QA + accessibility score; `UpdateAgent` re-checks every 30 days |
| 7 | `DeployerAgent` | Build + deploy to Vercel (dry-run if `VERCEL_TOKEN` unset) |

The web app streams every step to the browser over Server-Sent Events
(`apps/web/app/api/generate/route.ts`).

## Configuration

All keys are optional except `ANTHROPIC_API_KEY`. Without the others the
pipeline still completes end-to-end:

- no `SCRAPING_API_KEY` → competitor analysis uses the model's own knowledge
- no `VERCEL_TOKEN` → deploy is a dry-run, preview served locally

See `.env.example`.

## Honesty / legal note

The landing copy includes aspirational ROI figures and example testimonials.
They are **labelled as illustrative** in the UI. Before going live, replace
them with real, verifiable numbers and consented client testimonials to stay
compliant with advertising law (EU/DGCCRF, FTC, etc.).

## Layout

```
apps/web      Next.js 14 landing + dashboard + generate + API routes
apps/engine   the 11 agents, tools, orchestrator, CLI
packages/shared  shared TypeScript types
```
