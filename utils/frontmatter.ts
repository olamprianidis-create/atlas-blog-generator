export interface ArticleFrontmatter {
  title: string;
  author: string;
  date: string;
  keywords: string[];
  meta_description: string;
  category: string;
  readingTime: string;
}

function yamlEscape(value: string): string {
  if (/[:#[\]{}]/.test(value) || value.includes('"')) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

export function buildFrontmatterYaml(fm: ArticleFrontmatter): string {
  return [
    "---",
    `title: ${yamlEscape(fm.title)}`,
    `author: ${yamlEscape(fm.author)}`,
    `date: ${fm.date}`,
    `keywords: [${fm.keywords.map((k) => yamlEscape(k)).join(", ")}]`,
    `meta_description: ${yamlEscape(fm.meta_description)}`,
    `category: ${fm.category}`,
    `readingTime: ${yamlEscape(fm.readingTime)}`,
    "---",
  ].join("\n");
}
