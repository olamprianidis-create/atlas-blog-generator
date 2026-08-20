import fs from "fs";
import path from "path";
import { generateJSON } from "./anthropic";
import type { BlogOutline } from "./outline";
import type { ResearchQuery } from "./webSearch";
import { PLACEHOLDER_RELATED_ARTICLES } from "./relatedArticles";

export interface ArticleGenerationInput {
  categoryLabel: string;
  topic: string;
  outline: BlogOutline;
  keywords: string[];
  research: ResearchQuery[];
  editInstructions?: string;
}

export interface ArticleGenerationResult {
  title: string;
  markdown: string;
  metaDescription: string;
}

const EXTERNAL_CITATIONS = [
  { text: "Forbes", url: "https://www.forbes.com/" },
  { text: "Harvard Business Review", url: "https://hbr.org/" },
  { text: "Mayo Clinic", url: "https://www.mayoclinic.org/" },
  { text: "the CDC", url: "https://www.cdc.gov/" },
  { text: "the American Psychological Association", url: "https://www.apa.org/" },
  { text: "ESPN", url: "https://www.espn.com/" },
  { text: "Pew Research Center", url: "https://www.pewresearch.org/" },
  { text: "McKinsey & Company", url: "https://www.mckinsey.com/" },
];

function fitMetaDescription(base: string, min = 450, max = 500): string {
  let result = base;

  const fillers = [
    " Backed by current research and written for readers who want practical, no-fluff guidance.",
    " Atlas Network breaks down what actually works, with real examples you can apply today.",
    " Whether you're just getting started or refining your approach, this guide has you covered.",
  ];

  let fillerIndex = 0;
  while (result.length < min && fillerIndex < fillers.length) {
    result += fillers[fillerIndex];
    fillerIndex++;
  }

  if (result.length > max) {
    result = result.slice(0, max);
    const lastSpace = result.lastIndexOf(" ");
    result = result.slice(0, lastSpace > 0 ? lastSpace : max);
  }

  return result;
}

function buildMockMetaDescription(topic: string, mainKeyword: string, longTail: string[]): string {
  const lt = longTail.slice(0, 2).join(" and ") || "practical strategies";
  const base = `[MOCK] Everything you need to know about ${topic}: a complete guide covering ${mainKeyword}, ${lt}, and how to actually put it into practice. Atlas Network breaks down the research, the common mistakes, and a clear plan you can start using today.`;
  return fitMetaDescription(base);
}

function buildMockMarkdown(input: ArticleGenerationInput, mainKeyword: string, longTail: string[]): { title: string; markdown: string } {
  const { categoryLabel, topic, outline, research, editInstructions } = input;
  const title = `${topic.charAt(0).toUpperCase()}${topic.slice(1)}: A Practical ${categoryLabel} Guide`;

  const [articleA, articleB, articleC] = PLACEHOLDER_RELATED_ARTICLES;
  let citationIndex = 0;
  const nextCitation = () => {
    const citation = EXTERNAL_CITATIONS[citationIndex % EXTERNAL_CITATIONS.length];
    citationIndex++;
    return `[${citation.text}](${citation.url})`;
  };

  const findings = research.flatMap((r) => r.findings).map((f) => f.replace(/^\[MOCK\]\s*/i, ""));
  const nextFinding = (() => {
    let i = 0;
    return () => {
      const finding = findings[i % findings.length] ?? "consistent, repeatable habits outperform occasional big efforts";
      i++;
      return finding;
    };
  })();

  const categoryLower = categoryLabel.toLowerCase();

  const sections = outline.topicBreakdown.map((item, index) => {
    const [rawHeader] = item.split("—").map((s) => s.trim());
    const header = index === 0 ? `${rawHeader}: What This Means for ${mainKeyword}` : rawHeader;

    const internalLinkSentence =
      index === 0
        ? ` For a related read, see our piece on [${articleA.title}](${articleA.url}).`
        : index === 1
          ? ` We also cover this in more depth in [${articleB.title}](${articleB.url}).`
          : "";

    const para1 = `${item}. In practice, this comes down to a handful of repeatable habits rather than one big overhaul — start small, track what changes, and adjust from there.${internalLinkSentence}`;

    const para2 = `According to ${nextCitation()}, ${nextFinding().toLowerCase()} This lines up with what most people experience once they apply the framework consistently for a few weeks, and it's a big part of why quick fixes tend not to stick the way a small, repeatable habit does.`;

    const para3 = `The practical takeaway for ${categoryLower} is to treat this as a system, not a single decision. ${nextFinding()} — which is exactly why tracking progress weekly, rather than expecting overnight change, tends to produce better long-term results.`;

    const para4 = `It's worth being specific here rather than relying on vague intentions. Pick one concrete change related to ${mainKeyword}, apply it for two weeks, and only then decide whether to adjust — most people give up on a habit before it's had time to actually show results, and that's usually the real reason progress stalls rather than the approach itself being wrong. This is also where it helps to write the plan down somewhere visible, since intentions that live only in your head are the easiest ones to quietly drop the moment the week gets busy.`;

    return `## ${header}\n\n${para1}\n\n${para2}\n\n${para3}\n\n${para4}`;
  });

  const faqBlocks = outline.faqs
    .map(
      (faq) =>
        `### ${faq.question}\n\n${faq.answer} According to ${nextCitation()}, this is consistent with what most people find once they give the approach a real try rather than a one-off attempt, and it's worth revisiting the question again after a few weeks of consistent practice.`
    )
    .join("\n\n");

  const takeawaysIntro = `Pulling this together, here's what matters most if you only remember a few things about ${mainKeyword}:`;
  const takeawayBlocks = outline.takeaways.map((t) => `- ${t}`).join("\n");

  const editNote = editInstructions
    ? `\n_Revised based on feedback: ${editInstructions}_\n`
    : "";

  const keywordSentence = `This guide focuses on ${mainKeyword}${
    longTail.length ? `, along with related angles like ${longTail.slice(0, 2).join(" and ")}` : ""
  }, drawing on current research and practical, real-world examples rather than generic advice.`;

  const markdown = `# ${title}
${editNote}
${outline.hook}

${outline.quickAnswer} ${keywordSentence} According to ${nextCitation()}, this approach holds up well across different situations, which is part of why it's worth building into a routine rather than treating it as a one-off fix.

${sections.join("\n\n")}

## Example

${outline.example} As covered by ${nextCitation()}, examples like this are common once the underlying habit becomes consistent rather than occasional. It's a useful reminder that the goal isn't perfection — it's consistency applied to ${mainKeyword} over time.

## Frequently Asked Questions

${faqBlocks}

## Key Takeaways

${takeawaysIntro}

${takeawayBlocks}

## What to Do Next

${outline.cta} None of this needs to be complicated — pick the smallest version of the change, start this week, and give it longer than feels comfortable before deciding it isn't working.

Follow @atlasnetwork.club on Instagram for more practical ${categoryLower} guidance, real examples, and the occasional behind-the-scenes look at how we put this into practice ourselves.

## Related Reading

- [${articleA.title}](${articleA.url})
- [${articleB.title}](${articleB.url})
- [${articleC.title}](${articleC.url})
`;

  return { title, markdown };
}

const TEMPLATE_PATH = path.join(process.cwd(), "Blog_Structure_Prompt_UPDATED.md");

function loadTemplate(): string {
  try {
    return fs.readFileSync(TEMPLATE_PATH, "utf-8");
  } catch {
    return "(Blog_Structure_Prompt_UPDATED.md not found — proceeding without it.)";
  }
}

export async function generateArticle(input: ArticleGenerationInput): Promise<ArticleGenerationResult> {
  const mainKeyword = input.keywords[0] ?? input.topic;
  const longTail = input.keywords.slice(1);

  const mock = buildMockMarkdown(input, mainKeyword, longTail);
  const mockValue: ArticleGenerationResult = {
    title: mock.title,
    markdown: mock.markdown,
    metaDescription: buildMockMetaDescription(input.topic, mainKeyword, longTail),
  };

  const template = loadTemplate();
  const researchSummary = input.research
    .map((r) => `Query: ${r.query}\n${r.findings.map((f) => `- ${f}`).join("\n")}`)
    .join("\n\n");
  const relatedArticlesList = PLACEHOLDER_RELATED_ARTICLES.map(
    (a) => `- ${a.title} — ${a.url} (${a.category})`
  ).join("\n");

  const editInstructionsBlock = input.editInstructions
    ? `\n\nThe user requested these edits to a previous draft — apply them:\n${input.editInstructions}`
    : "";

  const prompt = `You are writing a full blog article for atlasnetwork.club. Follow this template exactly:

${template}

---

Category: ${input.categoryLabel}
Topic: ${input.topic}
Approved keywords (first is the main keyword, rest are long-tail): ${input.keywords.join(", ")}

Approved outline:
${JSON.stringify(input.outline, null, 2)}

Research findings to draw on:
${researchSummary || "(none)"}

Related atlasnetwork.club articles available for internal linking:
${relatedArticlesList}
${editInstructionsBlock}

Write the full article now. Respond with ONLY valid JSON, no markdown fences, no commentary, in this exact shape:
{"title": "...", "markdown": "... full article in markdown, starting with a single # H1 ...", "metaDescription": "... 450-500 characters ..."}`;

  return generateJSON<ArticleGenerationResult>(prompt, mockValue, {
    maxTokens: 8192,
    temperature: 0.8,
  });
}
