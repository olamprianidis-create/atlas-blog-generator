export interface MarkdownLink {
  text: string;
  url: string;
  isInternal: boolean;
  index: number;
}

const LINK_PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)/g;

export function extractLinks(markdown: string): MarkdownLink[] {
  const links: MarkdownLink[] = [];
  let match: RegExpExecArray | null;

  const pattern = new RegExp(LINK_PATTERN);
  while ((match = pattern.exec(markdown)) !== null) {
    const [, text, url] = match;
    links.push({
      text,
      url,
      isInternal: url.includes("atlasnetwork.club"),
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
