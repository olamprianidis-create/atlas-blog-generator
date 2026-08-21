import { slugify } from "./slug";

export const SITE_URL = "https://atlasnetwork.club";

export function buildArticleUrl(title: string): string {
  return `${SITE_URL}/article/${slugify(title)}`;
}
