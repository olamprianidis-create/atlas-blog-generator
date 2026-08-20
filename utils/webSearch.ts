import { webSearch } from "./anthropic";

export interface ResearchQuery {
  query: string;
  findings: string[];
}

// Runs the 4 fixed research queries for a topic/category and returns
// findings for each — used both to inform the outline now and to be
// stored for the full article-writing step later.
export async function runResearch(
  categoryLabel: string,
  topic: string
): Promise<ResearchQuery[]> {
  const subject = `${categoryLabel} ${topic}`.trim().replace(/\s+/g, " ");

  const queries = [
    `${subject} trends 2025`,
    `${subject} statistics`,
    `${subject} recent research`,
    `${subject} expert opinion`,
  ];

  return Promise.all(
    queries.map(async (query) => ({
      query,
      findings: await webSearch(query),
    }))
  );
}
