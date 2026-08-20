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
    .filter((p) => p.length > 0 && !p.startsWith("#") && !p.startsWith("-") && !p.startsWith("*"));
}

export function calculateReadingTime(wordCount: number, wordsPerMinute = 225): number {
  return Math.max(1, Math.round(wordCount / wordsPerMinute));
}
