export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

const API = 'https://app.scrapingbee.com/api/v1';

function key(): string | null {
  return process.env.SCRAPINGBEE_API_KEY || null;
}

/**
 * Google search via ScrapingBee's Google endpoint (returns structured JSON).
 * Returns [] when no API key is configured so callers can degrade gracefully.
 */
export async function searchCompetitors(query: string, count = 10): Promise<SearchResult[]> {
  const apiKey = key();
  if (!apiKey) return [];

  const url = `${API}/store/google?api_key=${apiKey}&search=${encodeURIComponent(
    query,
  )}&nb_results=${count}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`ScrapingBee search ${res.status}`);

  const json = (await res.json()) as {
    organic_results?: Array<{ title?: string; url?: string; description?: string }>;
  };

  return (json.organic_results ?? [])
    .filter((r) => r.url && !/google\.|youtube\.|wikipedia\./.test(r.url))
    .slice(0, count)
    .map((r) => ({
      title: r.title ?? '',
      url: r.url as string,
      snippet: r.description ?? '',
    }));
}

/**
 * Fetch a competitor page through ScrapingBee (JS-rendered), strip it to plain
 * visible text, and return a trimmed excerpt for analysis.
 */
export async function scrapePageText(pageUrl: string, maxChars = 3500): Promise<string> {
  const apiKey = key();
  if (!apiKey) return '';

  const url = `${API}/?api_key=${apiKey}&url=${encodeURIComponent(
    pageUrl,
  )}&render_js=true&block_resources=true&timeout=15000`;

  const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(`ScrapingBee fetch ${res.status}`);

  const html = await res.text();
  return htmlToText(html).slice(0, maxChars);
}

/** Crude but dependency-free HTML → text: drop scripts/styles, strip tags. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|section|li|h[1-6]|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const isScrapingBeeConfigured = () => Boolean(key());
