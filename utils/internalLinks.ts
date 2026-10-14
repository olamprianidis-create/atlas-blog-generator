// Server-only guard against dead internal links in generated articles.
// The model has invented atlasnetwork.club articles that were never
// published (and older output linked a non-existent /blog/ path), which
// end up as 404s on the live site. After generation, every link to
// atlasnetwork.club is checked against the real published articles:
// unknown ones are unwrapped to plain text in the body, dropped from the
// "Related Reading" list, and that section is removed if nothing is left.
import { getServiceClient } from "./supabase";
import { slugify } from "./slug";

const INTERNAL_LINK_RE = /\[([^\]]+)\]\((https?:\/\/(?:www\.)?atlasnetwork\.club[^)\s]*)\)/gi;

export async function listPublishedArticleSlugs(): Promise<Set<string>> {
  const { data, error } = await getServiceClient()
    .from("scheduled_articles")
    .select("title")
    .eq("status", "published");
  if (error) throw error;
  return new Set((data ?? []).map((row) => slugify(row.title as string)));
}

// Only /article/<slug> links to a published article count as valid; site
// pages (home, /articles, /signup…) are left alone.
function isDeadArticleLink(url: string, publishedSlugs: Set<string>): boolean {
  const path = url.replace(/^https?:\/\/(?:www\.)?atlasnetwork\.club/i, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
  const article = /^\/(article|blog)\/([^/]+)$/.exec(path);
  if (!article) return false;
  return article[1] === "blog" || !publishedSlugs.has(article[2]);
}

export function stripDeadInternalLinks(
  markdown: string,
  publishedSlugs: Set<string>
): { markdown: string; removed: string[] } {
  const removed: string[] = [];
  const relatedMatch = /^##\s+Related Reading\s*$/im.exec(markdown);
  const relatedStart = relatedMatch ? relatedMatch.index : -1;
  const afterHeading = relatedStart === -1 ? -1 : relatedStart + relatedMatch![0].length;
  const nextHeading = afterHeading === -1 ? -1 : markdown.slice(afterHeading).search(/^##\s/m);
  const relatedEnd = nextHeading === -1 ? markdown.length : afterHeading + nextHeading;

  let body = relatedStart === -1 ? markdown : markdown.slice(0, relatedStart);
  let related = relatedStart === -1 ? "" : markdown.slice(relatedStart, relatedEnd);
  const tail = relatedStart === -1 ? "" : markdown.slice(relatedEnd);

  body = body.replace(INTERNAL_LINK_RE, (full, text: string, url: string) => {
    if (!isDeadArticleLink(url, publishedSlugs)) return full;
    removed.push(url);
    return text;
  });

  if (related) {
    const lines = related.split("\n").filter((line) => {
      const link = /\[[^\]]+\]\(([^)\s]+)\)/.exec(line);
      if (!link || !/^\s*[-*]\s/.test(line)) return true;
      if (!isDeadArticleLink(link[1], publishedSlugs)) return true;
      removed.push(link[1]);
      return false;
    });
    related = lines.join("\n");
    // Nothing left but the heading — drop the whole section.
    if (!/^\s*[-*]\s+\[/m.test(related)) related = "";
  }

  const cleaned = (body + related + tail).replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
  return { markdown: cleaned, removed };
}
