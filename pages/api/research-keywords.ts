import type { NextApiRequest, NextApiResponse } from "next";
import { runResearch, ResearchQuery } from "../../utils/webSearch";
import { researchKeywords, KeywordResearchResult } from "../../utils/keywordResearch";
import { extractTopicPhrase } from "../../utils/topicExtraction";
import { Category, CATEGORIES } from "../../utils/types";

interface ResearchKeywordsResponse {
  research: ResearchQuery[];
  keywordResearch: KeywordResearchResult;
  extractedTopic: string;
}

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORIES.some((c) => c.value === value);
}

// Step 2 of the editor: keyword research runs independently of outline
// generation now, so the user can finalize their keyword selection before
// the outline (Step 3) is generated using those keywords as context.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResearchKeywordsResponse | { error: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { category, prompt, userReferenceKeywords, preliminaryKeywords } = req.body as {
    category?: unknown;
    prompt?: unknown;
    userReferenceKeywords?: unknown;
    preliminaryKeywords?: unknown;
  };

  if (category !== null && category !== undefined && !isCategory(category)) {
    return res.status(400).json({ error: "Invalid category" });
  }
  if (userReferenceKeywords !== undefined && typeof userReferenceKeywords !== "string") {
    return res.status(400).json({ error: "Invalid userReferenceKeywords" });
  }
  if (preliminaryKeywords !== undefined && typeof preliminaryKeywords !== "string") {
    return res.status(400).json({ error: "Invalid preliminaryKeywords" });
  }

  const selectedCategory = isCategory(category) ? category : null;
  const promptText = typeof prompt === "string" ? prompt.trim() : "";

  if (!promptText && !selectedCategory) {
    return res.status(400).json({ error: "Provide a prompt or select a topic" });
  }

  try {
    const categoryLabel = selectedCategory
      ? CATEGORIES.find((c) => c.value === selectedCategory)!.label
      : "General";

    const extractedTopic = promptText ? await extractTopicPhrase(promptText) : categoryLabel;
    const searchTopic = extractedTopic || promptText || categoryLabel;

    // Single shared web-search batch (4 queries) feeds both the general
    // research findings and the keyword-research analysis below — these
    // used to each run their own separate 4-query batch (8 searches
    // total per generation) covering largely overlapping ground.
    const research = await runResearch(categoryLabel, extractedTopic);
    const keywordResearch = await researchKeywords(
      searchTopic,
      research,
      typeof userReferenceKeywords === "string" ? userReferenceKeywords : undefined,
      typeof preliminaryKeywords === "string" ? preliminaryKeywords : undefined
    );

    return res.status(200).json({ research, keywordResearch, extractedTopic });
  } catch (error) {
    console.error("research-keywords failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Keyword research failed: ${message}` });
  }
}
