import { webSearch, generateJSON } from "./anthropic";

export type KeywordSource = "people_also_ask" | "related_searches" | "long_tail" | "competitor";
export type SearchIntent = "informational" | "commercial" | "transactional";

export interface DiscoveredKeyword {
  keyword: string;
  source: KeywordSource;
  intent: SearchIntent;
  ranking: number; // 1-10
}

export interface UserKeywordAnalysis {
  keyword: string;
  found: boolean;
  potential: number; // 1-10
}

export interface KeywordResearchResult {
  queriesRun: string[];
  discoveredKeywords: DiscoveredKeyword[];
  userKeywordsAnalyzed: UserKeywordAnalysis[];
  recommendations: string[];
  strategy: string;
}

interface RawFinding {
  source: KeywordSource;
  query: string;
  findings: string[];
}

function buildQueries(topic: string): { source: KeywordSource; query: string }[] {
  return [
    { source: "people_also_ask", query: `${topic} people also ask questions` },
    { source: "related_searches", query: `${topic} related searches google` },
    { source: "long_tail", query: `${topic} long-tail keyword variations` },
    { source: "competitor", query: `${topic} competitor keywords` },
  ];
}

function parseReferenceKeywords(userReferenceKeywords?: string): string[] {
  if (!userReferenceKeywords) return [];
  return Array.from(
    new Set(
      userReferenceKeywords
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0)
    )
  );
}

function buildMockResult(topic: string, referenceKeywords: string[]): KeywordResearchResult {
  const discoveredKeywords: DiscoveredKeyword[] = [
    { keyword: `${topic} for beginners`, source: "people_also_ask", intent: "informational", ranking: 8 },
    { keyword: `best ${topic} strategies`, source: "related_searches", intent: "commercial", ranking: 7 },
    { keyword: `how to start ${topic}`, source: "long_tail", intent: "informational", ranking: 9 },
    { keyword: `${topic} vs alternatives`, source: "competitor", intent: "commercial", ranking: 6 },
    { keyword: `${topic} step by step guide`, source: "long_tail", intent: "informational", ranking: 8 },
  ];

  return {
    queriesRun: buildQueries(topic).map((q) => q.query),
    discoveredKeywords,
    userKeywordsAnalyzed: referenceKeywords.map((keyword, index) => ({
      keyword,
      found: index % 2 === 0,
      potential: 6 + (index % 4),
    })),
    recommendations: [...discoveredKeywords.map((k) => k.keyword), `${topic} explained`, `${topic} tips`].slice(0, 8),
    strategy:
      "[MOCK] Keywords are clustered around informational \"how to\" queries (highest volume, lowest competition) with a smaller set of commercial comparison queries to capture readers closer to a decision.",
  };
}

// Runs 4 web searches to discover long-tail keyword opportunities for a
// topic (no more static category keyword lists), then has Claude analyze,
// cluster, and rank the findings — optionally comparing them against
// keywords the user already had in mind.
export async function researchKeywords(
  topic: string,
  userReferenceKeywords?: string,
  preliminaryKeywords?: string
): Promise<KeywordResearchResult> {
  const referenceKeywords = parseReferenceKeywords(userReferenceKeywords);
  const primaryKeywords = parseReferenceKeywords(preliminaryKeywords);
  const mockValue = buildMockResult(topic, referenceKeywords);

  const queries = buildQueries(topic);
  const rawFindings: RawFinding[] = await Promise.all(
    queries.map(async ({ source, query }) => ({
      source,
      query,
      findings: await webSearch(query),
    }))
  );

  const findingsSummary = rawFindings
    .map((r) => `[${r.source}] Query: ${r.query}\n${r.findings.map((f) => `- ${f}`).join("\n")}`)
    .join("\n\n");

  const referenceSummary = referenceKeywords.length
    ? referenceKeywords.join(", ")
    : "(none provided — analyze research findings only)";

  const primarySummary = primaryKeywords.length
    ? primaryKeywords.join(", ")
    : "(none provided)";

  const primaryInstruction = primaryKeywords.length
    ? `\n\nThe user has provided PRIMARY keywords they want this article to rank for above all else: ${primarySummary}. For each primary keyword, generate at least 2-3 medium-tail (3-4 word) and long-tail (5+ word) variations that naturally implement/incorporate that primary keyword (e.g. primary "protein intake" → medium-tail "daily protein intake guide", long-tail "how much protein intake for muscle building"). Include these variations in discoveredKeywords (source "long_tail") and weight the primary keywords and their variations heavily in your top recommendations.`
    : "";

  const prompt = `You are an SEO keyword researcher analyzing web search findings for a blog article on atlasnetwork.club.

Topic: ${topic}

Raw findings from 4 web searches (People Also Ask questions, Google related searches, long-tail variations, and competitor keywords):
${findingsSummary}

User's reference keywords (keywords the user already had in mind, may be empty): ${referenceSummary}
User's primary/preliminary keywords (the main terms they want to primarily rank for, may be empty): ${primarySummary}${primaryInstruction}

Do the following:
1. Extract concrete long-tail keyword phrases (ideally 3-5 words) from the findings above. For each, classify:
   - source: one of "people_also_ask", "related_searches", "long_tail", "competitor" (whichever search it came from or most resembles)
   - intent: one of "informational", "commercial", "transactional"
   - ranking: 1-10 score for AI-search/SEO ranking potential (10 = best opportunity)
2. For each user reference keyword, determine:
   - found: whether it appeared in or closely matches the research findings
   - potential: 1-10 score for its optimization potential for this article
3. Recommend the top 8 keywords overall (a mix of the best discovered keywords, the primary-keyword variations described above, and any strong user reference keywords), as a flat array of strings.
4. Write a brief (2-3 sentence) explanation of the semantic clustering/strategy behind your recommendations.

Respond with ONLY valid JSON in this exact shape, no markdown fences, no commentary:
{"discoveredKeywords": [{"keyword": "...", "source": "...", "intent": "...", "ranking": 1}], "userKeywordsAnalyzed": [{"keyword": "...", "found": true, "potential": 1}], "recommendations": ["..."], "strategy": "..."}`;

  const analyzed = await generateJSON<
    Omit<KeywordResearchResult, "queriesRun">
  >(prompt, mockValue, { maxTokens: 8192 });

  return {
    queriesRun: queries.map((q) => q.query),
    ...analyzed,
  };
}
