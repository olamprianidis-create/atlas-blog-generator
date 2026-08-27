import type { NextApiRequest, NextApiResponse } from "next";
import { generateArticle } from "../../utils/article";
import { markdownToHtml } from "../../utils/renderMarkdown";
import { buildFrontmatterYaml, ArticleFrontmatter } from "../../utils/frontmatter";
import { runQualityChecklist, QualityCheckResult } from "../../utils/qualityChecklist";
import { countWords, calculateReadingTime } from "../../utils/markdown";
import type { BlogOutline } from "../../utils/outline";
import type { ResearchQuery } from "../../utils/webSearch";
import { Category, CATEGORIES } from "../../utils/types";
import type { RelatedArticleItem } from "../../utils/relatedArticles";
import { documentsToResearchQueries, isReferenceDocumentList } from "../../utils/referenceDocuments";

interface GenerateArticleRequestBody {
  category?: unknown;
  topic?: unknown;
  outline?: unknown;
  keywords?: unknown;
  research?: unknown;
  documents?: unknown;
  relatedArticles?: unknown;
  editInstructions?: unknown;
}

function isRelatedArticleList(value: unknown): value is RelatedArticleItem[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as RelatedArticleItem).title === "string" &&
        typeof (item as RelatedArticleItem).url === "string"
    )
  );
}

interface GenerateArticleResponse {
  title: string;
  markdown: string;
  html: string;
  metaDescription: string;
  frontmatter: ArticleFrontmatter;
  frontmatterYaml: string;
  wordCount: number;
  readingTimeMinutes: number;
  checklist: QualityCheckResult[];
}

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORIES.some((c) => c.value === value);
}

function isOutline(value: unknown): value is BlogOutline {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.hook === "string" &&
    typeof o.quickAnswer === "string" &&
    Array.isArray(o.topicBreakdown) &&
    typeof o.example === "string" &&
    Array.isArray(o.faqs) &&
    Array.isArray(o.takeaways) &&
    typeof o.cta === "string"
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateArticleResponse | { error: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { category, topic, outline, keywords, research, documents, relatedArticles, editInstructions } =
    req.body as GenerateArticleRequestBody;

  if (!isOutline(outline)) {
    return res.status(400).json({ error: "Missing or invalid outline" });
  }

  if (!Array.isArray(keywords) || !keywords.every((k) => typeof k === "string")) {
    return res.status(400).json({ error: "Missing or invalid keywords" });
  }

  if (documents !== undefined && !isReferenceDocumentList(documents)) {
    return res.status(400).json({ error: "Invalid documents" });
  }

  const selectedCategory = isCategory(category) ? category : null;
  const categoryLabel = selectedCategory
    ? CATEGORIES.find((c) => c.value === selectedCategory)!.label
    : "General";
  const topicText = typeof topic === "string" && topic.trim() ? topic.trim() : categoryLabel;
  const researchList: ResearchQuery[] = [
    ...(Array.isArray(research) ? (research as ResearchQuery[]) : []),
    ...documentsToResearchQueries(isReferenceDocumentList(documents) ? documents : []),
  ];
  const relatedArticlesList: RelatedArticleItem[] = isRelatedArticleList(relatedArticles) ? relatedArticles : [];
  const editInstructionsText =
    typeof editInstructions === "string" && editInstructions.trim() ? editInstructions.trim() : undefined;

  try {
    const { title, markdown, metaDescription } = await generateArticle({
      categoryLabel,
      topic: topicText,
      outline,
      keywords,
      research: researchList,
      relatedArticles: relatedArticlesList,
      editInstructions: editInstructionsText,
    });

    const wordCount = countWords(markdown);
    const readingTimeMinutes = calculateReadingTime(wordCount);

    const frontmatter: ArticleFrontmatter = {
      title,
      author: "Atlas Network",
      date: new Date().toISOString().slice(0, 10),
      keywords,
      meta_description: metaDescription,
      category: categoryLabel,
      readingTime: `${readingTimeMinutes} min read`,
    };

    const html = markdownToHtml(markdown);

    const checklist = runQualityChecklist({
      markdown,
      metaDescription,
      mainKeyword: keywords[0] ?? "",
      longTailKeywords: keywords.slice(1),
    });

    return res.status(200).json({
      title,
      markdown,
      html,
      metaDescription,
      frontmatter,
      frontmatterYaml: buildFrontmatterYaml(frontmatter),
      wordCount,
      readingTimeMinutes,
      checklist,
    });
  } catch (error) {
    console.error("generate-article failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Article generation failed: ${message}` });
  }
}
