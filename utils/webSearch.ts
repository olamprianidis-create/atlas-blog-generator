import { webSearch } from "./anthropic";

export interface ResearchQuery {
  query: string;
  findings: string[];
}

// Runs 4 shared research queries for a topic/category and returns
// findings for each. This single batch feeds three consumers: the
// outline (utils/outline.ts), the full article draft (utils/article.ts),
// and keyword research (utils/keywordResearch.ts, which used to run its
// own separate 4-query batch covering near-identical ground — merged
// here so a single article generation fires 4 web searches total
// instead of 8). Each query is written to surface both general
// content-research findings (trends, stats, expert opinion) and
// SEO/keyword-shaped findings (People Also Ask, related searches,
// long-tail, competitor angles) in the same pass.
export async function runResearch(
  categoryLabel: string,
  topic: string
): Promise<ResearchQuery[]> {
  const subject = `${categoryLabel} ${topic}`.trim().replace(/\s+/g, " ");

  const queries = [
    `${subject} trends 2025 and recent statistics`,
    `${subject} people also ask and related search queries`,
    `${subject} long-tail keyword variations and competitor angles`,
    `${subject} expert opinion and recent research`,
  ];

  return Promise.all(
    queries.map(async (query) => ({
      query,
      findings: await webSearch(query),
    }))
  );
}
