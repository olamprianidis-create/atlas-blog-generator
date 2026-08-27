import type { NextApiRequest, NextApiResponse } from "next";
import { generateOutline, BlogOutline } from "../../utils/outline";
import { ResearchQuery } from "../../utils/webSearch";
import { Category, CATEGORIES } from "../../utils/types";
import { documentsToResearchQueries, isReferenceDocumentList } from "../../utils/referenceDocuments";

interface GenerateOutlineResponse {
  outline: BlogOutline;
}

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORIES.some((c) => c.value === value);
}

function isResearchList(value: unknown): value is ResearchQuery[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as ResearchQuery).query === "string" &&
        Array.isArray((item as ResearchQuery).findings)
    )
  );
}

// Step 3 of the editor: generates the outline using the topic, the
// keywords finalized at Step 2, and the research already gathered there —
// no new web searches happen here.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateOutlineResponse | { error: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { category, prompt, extractedTopic, keywords, research, documents } = req.body as {
    category?: unknown;
    prompt?: unknown;
    extractedTopic?: unknown;
    keywords?: unknown;
    research?: unknown;
    documents?: unknown;
  };

  if (category !== null && category !== undefined && !isCategory(category)) {
    return res.status(400).json({ error: "Invalid category" });
  }
  if (!Array.isArray(keywords) || !keywords.every((k) => typeof k === "string")) {
    return res.status(400).json({ error: "Missing or invalid keywords" });
  }
  if (research !== undefined && !isResearchList(research)) {
    return res.status(400).json({ error: "Invalid research" });
  }
  if (documents !== undefined && !isReferenceDocumentList(documents)) {
    return res.status(400).json({ error: "Invalid documents" });
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
    const topic = promptText || (typeof extractedTopic === "string" ? extractedTopic : "") || categoryLabel;

    const combinedResearch: ResearchQuery[] = [
      ...(isResearchList(research) ? research : []),
      ...documentsToResearchQueries(isReferenceDocumentList(documents) ? documents : []),
    ];

    const { outline } = await generateOutline({
      categoryLabel,
      topic,
      keywords,
      research: combinedResearch,
    });

    return res.status(200).json({ outline });
  } catch (error) {
    console.error("generate-outline failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Outline generation failed: ${message}` });
  }
}
