import type { NextApiRequest, NextApiResponse } from "next";
import { runResearch, ResearchQuery } from "../../utils/webSearch";
import { generateOutline, BlogOutline } from "../../utils/outline";
import { researchKeywords, KeywordResearchResult } from "../../utils/keywordResearch";
import { extractTopicPhrase } from "../../utils/topicExtraction";
import { Category, CATEGORIES } from "../../utils/types";

interface GenerateOutlineResponse {
  research: ResearchQuery[];
  outline: BlogOutline;
  keywordResearch: KeywordResearchResult;
  originalPrompt: string;
  extractedTopic: string;
}

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORIES.some((c) => c.value === value);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateOutlineResponse | { error: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { category, prompt, userReferenceKeywords } = req.body as {
    category?: unknown;
    prompt?: unknown;
    userReferenceKeywords?: unknown;
  };

  if (category !== null && category !== undefined && !isCategory(category)) {
    return res.status(400).json({ error: "Invalid category" });
  }
  if (userReferenceKeywords !== undefined && typeof userReferenceKeywords !== "string") {
    return res.status(400).json({ error: "Invalid userReferenceKeywords" });
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
    const topic = promptText || categoryLabel;

    // Short 2-4 word phrase used for search queries, kept separate from
    // the full prompt/topic used for outline generation.
    const extractedTopic = promptText ? await extractTopicPhrase(promptText) : categoryLabel;
    const searchTopic = extractedTopic || topic;

    const [research, keywordResearch] = await Promise.all([
      runResearch(categoryLabel, extractedTopic),
      researchKeywords(searchTopic, typeof userReferenceKeywords === "string" ? userReferenceKeywords : undefined),
    ]);

    const { outline } = await generateOutline({
      categoryLabel,
      topic,
      keywords: keywordResearch.recommendations,
      research,
    });

    return res.status(200).json({
      research,
      outline,
      keywordResearch,
      originalPrompt: promptText,
      extractedTopic,
    });
  } catch (error) {
    console.error("generate-outline failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Generation failed: ${message}` });
  }
}
