export interface MarkdownLink {
  text: string;
  url: string;
  isInternal: boolean;
  index: number;
}

const LINK_PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)/g;

// Checks the actual hostname, not a substring match — otherwise a link
// like https://www.instagram.com/atlasnetwork.club (an Instagram profile,
// not a blog article) gets misclassified as an internal atlasnetwork.club
// link just because the string appears in the path.
function isInternalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "atlasnetwork.club";
  } catch {
    return false;
  }
}

export function extractLinks(markdown: string): MarkdownLink[] {
  const links: MarkdownLink[] = [];
  let match: RegExpExecArray | null;

  const pattern = new RegExp(LINK_PATTERN);
  while ((match = pattern.exec(markdown)) !== null) {
    const [, text, url] = match;
    links.push({
      text,
      url,
      isInternal: isInternalUrl(url),
      index: match.index,
    });
  }

  return links;
}

export function countWords(markdown: string): number {
  const stripped = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_>`-]/g, " ");

  return stripped.split(/\s+/).filter(Boolean).length;
}

export interface Heading {
  level: number;
  text: string;
}

export function extractHeadings(markdown: string): Heading[] {
  return markdown
    .split("\n")
    .filter((line) => /^#{1,6}\s/.test(line))
    .map((line) => {
      const level = line.match(/^#+/)![0].length;
      const text = line.replace(/^#{1,6}\s*/, "").trim();
      return { level, text };
    });
}

export function getParagraphs(markdown: string): string[] {
  return markdown
    .split("\n\n")
    .map((p) => p.trim())
    .filter(
      (p) =>
        p.length > 0 &&
        !p.startsWith("#") &&
        !p.startsWith("-") &&
        !p.startsWith("*") &&
        !p.startsWith(">") &&
        !/^\d+\.\s/.test(p)
    );
}

export function calculateReadingTime(wordCount: number, wordsPerMinute = 225): number {
  return Math.max(1, Math.round(wordCount / wordsPerMinute));
}

// Rough sentence count via terminal punctuation — good enough for a
// pacing heuristic, doesn't need to handle every abbreviation edge case.
// Strips markdown link URLs first so periods inside domains
// (e.g. "www.forbes.com") don't get counted as sentence breaks.
export function countSentences(text: string): number {
  const withoutLinkUrls = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  const matches = withoutLinkUrls.match(/[^.!?]+[.!?]+/g);
  return matches ? matches.length : withoutLinkUrls.trim().length > 0 ? 1 : 0;
}

// Counts distinct contiguous blocks of lines matching `linePattern`
// (e.g. bullet lines, numbered lines) — a block is one list section,
// not one item, so "3 bullets in a row" counts as 1 list.
function countListBlocks(markdown: string, linePattern: RegExp): number {
  const lines = markdown.split("\n");
  let blocks = 0;
  let inBlock = false;

  for (const line of lines) {
    const isListLine = linePattern.test(line.trim());
    if (isListLine && !inBlock) {
      blocks++;
      inBlock = true;
    } else if (!isListLine && line.trim() !== "") {
      inBlock = false;
    }
  }

  return blocks;
}

export function countBulletListBlocks(markdown: string): number {
  return countListBlocks(markdown, /^[-*]\s+/);
}

export function countNumberedListBlocks(markdown: string): number {
  return countListBlocks(markdown, /^\d+\.\s+/);
}

// Matches the "> **\"quote\"**" pull-quote format requested in the brand
// style guide — one blockquote line starting with a bolded quoted phrase.
export function countPullQuotes(markdown: string): number {
  const matches = markdown.match(/^>\s*\*\*/gm);
  return matches ? matches.length : 0;
}

// Paragraphs appearing before the first "## " heading, excluding the H1
// title line itself — used to check the hook's line-by-line pacing.
export function getPreHeadingParagraphs(markdown: string): string[] {
  const firstH2Match = markdown.match(/^##\s/m);
  const cutoff = firstH2Match ? markdown.indexOf(firstH2Match[0]) : markdown.length;
  const before = markdown.slice(0, cutoff);

  return before
    .split("\n\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !p.startsWith("#"));
}
