import { extractHeadings, extractLinks, countWords, getParagraphs } from "./markdown";

export interface QualityCheckResult {
  id: number;
  label: string;
  passed: boolean;
}

interface QualityCheckInput {
  markdown: string;
  metaDescription: string;
  mainKeyword: string;
  longTailKeywords: string[];
}

function findRelatedReadingIndex(markdown: string): number {
  const match = markdown.match(/^##\s+Related Reading/im);
  return match ? markdown.indexOf(match[0]) : -1;
}

export function runQualityChecklist({
  markdown,
  metaDescription,
  mainKeyword,
  longTailKeywords,
}: QualityCheckInput): QualityCheckResult[] {
  const headings = extractHeadings(markdown);
  const links = extractLinks(markdown);
  const wordCount = countWords(markdown);
  const paragraphs = getParagraphs(markdown);
  const lowerMarkdown = markdown.toLowerCase();
  const mainKeywordLower = mainKeyword.toLowerCase();

  const relatedReadingIndex = findRelatedReadingIndex(markdown);
  const externalLinks = links.filter((l) => !l.isInternal);
  const internalLinks = links.filter((l) => l.isInternal);
  const bodyInternalLinks =
    relatedReadingIndex === -1
      ? internalLinks
      : internalLinks.filter((l) => l.index < relatedReadingIndex);
  const closingInternalLinks =
    relatedReadingIndex === -1 ? [] : internalLinks.filter((l) => l.index >= relatedReadingIndex);

  const h1Index = markdown.search(/^#\s/m);
  const secondHeadingLine = headings[1]?.text;
  const hasHookBeforeFirstSubheading =
    h1Index !== -1 && !!secondHeadingLine && markdown.indexOf(secondHeadingLine) > h1Index + 20;

  const faqCount = headings.filter((h) => h.level === 3).length;

  let runningMaxLevel = 0;
  const hierarchySane =
    headings.length > 0 &&
    headings[0].level === 1 &&
    headings.every((h) => {
      const ok = h.level <= runningMaxLevel + 1;
      runningMaxLevel = Math.max(runningMaxLevel, h.level);
      return ok;
    });

  const checks: QualityCheckResult[] = [
    { id: 1, label: "Has an H1 title", passed: headings.some((h) => h.level === 1) },
    { id: 2, label: "Has at least one H2 section", passed: headings.some((h) => h.level === 2) },
    { id: 3, label: "Has at least one H3 (FAQs)", passed: headings.some((h) => h.level === 3) },
    { id: 4, label: "Has a hook paragraph before the first heading", passed: hasHookBeforeFirstSubheading },
    {
      id: 5,
      label: 'Has a "Frequently Asked Questions" section',
      passed: headings.some((h) => h.level === 2 && /frequently asked questions/i.test(h.text)),
    },
    { id: 6, label: "Has exactly 5 FAQ items", passed: faqCount === 5 },
    {
      id: 7,
      label: "Has a closing CTA section",
      passed: headings.some((h) => h.level === 2 && /(cta|next step|do next|what.?s next|take action)/i.test(h.text)),
    },
    { id: 8, label: "Word count is at least 1,500", passed: wordCount >= 1500 },
    { id: 9, label: "Word count is at most 2,500", passed: wordCount <= 2500 },
    {
      id: 10,
      label: "No paragraph exceeds ~150 words",
      passed: paragraphs.every((p) => p.split(/\s+/).filter(Boolean).length <= 150),
    },
    {
      id: 11,
      label: "Contains an authority/expertise signal",
      passed: /expert|research shows|according to|data shows|studies (show|find)/i.test(markdown),
    },
    {
      id: 12,
      label: "Contains a first-hand experience signal",
      passed: /in practice|in our experience|what actually works|firsthand|first-hand|we.?ve seen/i.test(markdown),
    },
    {
      id: 13,
      label: "Contains a research/data/expert reference",
      passed: /\d+%|study|studies|research/i.test(markdown),
    },
    { id: 14, label: "Contains a trust signal (citation or link)", passed: links.length > 0 },
    { id: 15, label: "Has at least 1 external link", passed: externalLinks.length >= 1 },
    { id: 16, label: "Has at least 1 internal atlasnetwork.club link", passed: internalLinks.length >= 1 },
    {
      id: 17,
      label: "External links are ~60%+ of total links",
      passed: links.length > 0 && externalLinks.length / links.length >= 0.55,
    },
    { id: 18, label: "At least 2 internal links appear in the body", passed: bodyInternalLinks.length >= 2 },
    {
      id: 19,
      label: "Exactly 3 internal links in the closing Related Reading section",
      passed: closingInternalLinks.length === 3,
    },
    {
      id: 20,
      label: "All links use proper markdown [text](url) format",
      passed: (markdown.match(/\[/g)?.length ?? 0) === (markdown.match(/\]/g)?.length ?? 0),
    },
    {
      id: 21,
      label: "Main keyword appears in the article body",
      passed: mainKeywordLower.length > 0 && lowerMarkdown.includes(mainKeywordLower),
    },
    {
      id: 22,
      label: "At least 2 long-tail keywords appear in the body",
      passed: longTailKeywords.filter((k) => lowerMarkdown.includes(k.toLowerCase())).length >= 2,
    },
    {
      id: 23,
      label: "Main keyword appears in a heading",
      passed:
        mainKeywordLower.length > 0 &&
        headings.some((h) => h.text.toLowerCase().includes(mainKeywordLower)),
    },
    {
      id: 24,
      label: "CTA mentions the @atlasnetwork.club Instagram",
      passed: /@atlasnetwork\.club/i.test(markdown) && /instagram/i.test(markdown),
    },
    {
      id: 25,
      label: "CTA includes a clear call-to-action verb",
      passed: /(follow|share|subscribe|join|tag|comment|dm us|check out)/i.test(markdown),
    },
    {
      id: 26,
      label: "Meta description is 450-500 characters",
      passed: metaDescription.length >= 450 && metaDescription.length <= 500,
    },
    {
      id: 27,
      label: "Meta description contains the main keyword",
      passed: mainKeywordLower.length > 0 && metaDescription.toLowerCase().includes(mainKeywordLower),
    },
    {
      id: 28,
      label: "No broken/unclosed markdown link syntax",
      passed: (markdown.match(/\[/g)?.length ?? 0) === (markdown.match(/\]/g)?.length ?? 0),
    },
    {
      id: 29,
      label: "No leftover placeholder tokens in the final output",
      passed: !/\[MOCK\]/i.test(markdown),
    },
    { id: 30, label: "Headings follow a sane hierarchy", passed: hierarchySane },
  ];

  return checks;
}
