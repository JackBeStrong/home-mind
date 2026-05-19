/**
 * Web Search via Brave Search API
 *
 * Provides web_search and news_search tools for the LLM to access
 * real-time internet information. Uses the Brave Search API which
 * offers both general web search and dedicated news search endpoints.
 *
 * Free tier: 2,000 queries/month (plenty for a home assistant).
 * Docs: https://api.search.brave.com/app/documentation/web-search/get-started
 */

const BRAVE_WEB_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";
const BRAVE_NEWS_SEARCH_URL = "https://api.search.brave.com/res/v1/news/search";

/** Max results to return to the LLM to avoid blowing context window */
const MAX_WEB_RESULTS = 5;
const MAX_NEWS_RESULTS = 5;

export interface WebSearchResult {
  title: string;
  url: string;
  description: string;
}

export interface NewsSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
  source?: string;
}

/**
 * Search the web using Brave Search API.
 * Returns top results with title, URL, and description.
 */
export async function webSearch(
  apiKey: string,
  query: string,
  count: number = MAX_WEB_RESULTS
): Promise<WebSearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    count: String(Math.min(count, 20)),
    text_decorations: "false",
  });

  const response = await fetch(`${BRAVE_WEB_SEARCH_URL}?${params}`, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brave web search failed (${response.status}): ${body}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await response.json()) as any;
  const results: WebSearchResult[] = [];

  if (data.web?.results) {
    for (const r of data.web.results.slice(0, count)) {
      results.push({
        title: r.title ?? "",
        url: r.url ?? "",
        description: r.description ?? "",
      });
    }
  }

  return results;
}

/**
 * Search for news using Brave News Search API.
 * Returns top news articles with title, URL, description, age, and source.
 */
export async function newsSearch(
  apiKey: string,
  query: string,
  count: number = MAX_NEWS_RESULTS,
  freshness?: string
): Promise<NewsSearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    count: String(Math.min(count, 20)),
    text_decorations: "false",
  });

  if (freshness) {
    params.set("freshness", freshness);
  }

  const response = await fetch(`${BRAVE_NEWS_SEARCH_URL}?${params}`, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brave news search failed (${response.status}): ${body}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await response.json()) as any;
  const results: NewsSearchResult[] = [];

  if (data.results) {
    for (const r of data.results.slice(0, count)) {
      results.push({
        title: r.title ?? "",
        url: r.url ?? "",
        description: r.description ?? "",
        age: r.age ?? undefined,
        source: r.meta_url?.hostname ?? r.source ?? undefined,
      });
    }
  }

  return results;
}
