export interface ScrapedCompetitor {
  name: string;
  url: string;
  snippet: string;
}

/**
 * Fetches lightweight competitor snippets for a sector query.
 *
 * Uses a generic scraping/search API (set SCRAPING_API_KEY). The endpoint is
 * configurable via SCRAPING_API_URL so you can point it at SerpAPI, Tavily,
 * Brave Search, etc. Returns [] when unconfigured — the CompetitorAgent then
 * reasons from the model's own knowledge instead of failing.
 */
export async function scrapeCompetitors(query: string): Promise<ScrapedCompetitor[]> {
  const key = process.env.SCRAPING_API_KEY;
  if (!key) return [];

  const base = process.env.SCRAPING_API_URL || 'https://api.tavily.com/search';

  const res = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      query: `best ${query} websites`,
      max_results: 20,
      include_answer: false,
    }),
  });

  if (!res.ok) throw new Error(`Scrape failed: ${res.status}`);
  const json = (await res.json()) as { results?: Array<{ title: string; url: string; content: string }> };

  return (json.results ?? []).slice(0, 20).map((r) => ({
    name: r.title,
    url: r.url,
    snippet: (r.content || '').slice(0, 400),
  }));
}
