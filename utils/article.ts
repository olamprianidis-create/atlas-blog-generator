import fs from "fs";
import path from "path";
import { generateTextChecked } from "./anthropic";
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

    const para1 = `${item}. In practice, this comes down to a handful of repeatable habits rather than one big overhaul.${internalLinkSentence}`;

    const para2 = `According to ${nextCitation()}, ${nextFinding().toLowerCase()} That's a big part of why quick fixes tend not to stick.`;

    const para3 = `Treat this as a system, not a single decision for ${categoryLower}. ${nextFinding()}`;

    if (index === 0) {
      const steps = [
        `Pick one concrete change related to ${mainKeyword}.`,
        `Apply it consistently for two weeks before judging results.`,
        `Track progress weekly instead of expecting overnight change.`,
      ];
      const numberedList = steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
      const pullQuote = `> **"${nextFinding()}"**\n>\n> *That's the difference between a fad and a habit that sticks.*`;

      return `## ${header}\n\n${para1}\n\n${para2}\n\n${pullQuote}\n\n${para3}\n\n${numberedList}`;
    }

    if (index === 1) {
      const watchFor = [
        `Chasing intensity instead of consistency.`,
        `Giving up before the habit has time to compound.`,
        `Treating the plan as a one-off instead of a system.`,
      ];
      const bulletList = watchFor.map((w) => `- ${w}`).join("\n");

      return `## ${header}\n\n${para1}\n\n${para2}\n\nWatch out for a few common mistakes:\n\n${bulletList}\n\n${para3}`;
    }

    return `## ${header}\n\n${para1}\n\n${para2}\n\n${para3}`;
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

const MARKDOWN_DELIMITER = "===MARKDOWN===";

function buildMockDelimitedText(value: ArticleGenerationResult): string {
  return `TITLE: ${value.title}\nMETA_DESCRIPTION: ${value.metaDescription}\n${MARKDOWN_DELIMITER}\n${value.markdown}`;
}

// Parses the TITLE / META_DESCRIPTION / ===MARKDOWN=== plain-text format
// instead of JSON — asking a model to embed several paragraphs of
// markdown inside a JSON string is fragile (it sometimes emits literal
// newlines instead of escaped \n, breaking JSON.parse). This format
// sidesteps that entirely since only short single-line fields need any
// escaping discipline at all.
function parseArticleResponse(text: string): ArticleGenerationResult {
  const delimiterIndex = text.indexOf(MARKDOWN_DELIMITER);

  if (delimiterIndex === -1) {
    throw new Error(
      `Article response missing ${MARKDOWN_DELIMITER} delimiter. First 300 chars: ${text.slice(0, 300)}`
    );
  }

  const header = text.slice(0, delimiterIndex);
  const markdown = text.slice(delimiterIndex + MARKDOWN_DELIMITER.length).trim();

  const titleMatch = header.match(/TITLE:\s*(.+)/i);
  const metaMatch = header.match(/META_DESCRIPTION:\s*(.+)/i);

  if (!titleMatch || !metaMatch) {
    throw new Error(`Article response missing TITLE or META_DESCRIPTION header. Header: ${header.slice(0, 300)}`);
  }

  if (!markdown) {
    throw new Error("Article response had an empty markdown body after the delimiter.");
  }

  return {
    title: titleMatch[1].trim(),
    metaDescription: metaMatch[1].trim(),
    markdown,
  };
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

Hard requirements — the article will be rejected if any of these are missed:
- Aim for 1,800-2,200 words (never under 1,600) — the floor is 1,500 and running short fails review, so write generously rather than tightly.
- The closing CTA section's heading must be exactly "## What to Do Next" (this exact text — a checklist matches on it).
- That section must literally mention "@atlasnetwork.club" and the word "Instagram".
- Include roughly 8-10 external citation links total (spread across the body, e.g. "According to [Forbes](https://www.forbes.com/)..."), pointing to real, well-known, relevant domains for the category (e.g. Forbes, Harvard Business Review, Mayo Clinic, CDC, APA, ESPN, Pew Research, McKinsey). These external links must outnumber internal links by roughly 3:2 or more — internal links are capped at 2-3 in the body plus exactly 3 in Related Reading, so err toward more external citations, not fewer.
- Weave in 2-3 of the related atlasnetwork.club articles above as natural in-body links, using their exact URLs, plus list all 3 again under a closing "## Related Reading" section as a markdown list.

Formatting & pacing — ATLAS Network's brand voice is fast to read and easy to scan. The article will be rejected if any of these are missed:
- Paragraphs: maximum 3 sentences each, target 2. Break up longer thoughts into multiple short paragraphs instead of one dense block. Use generous whitespace — never write a paragraph that reads as a wall of text.
- Lists: include at least 2-3 bullet-point list sections and at least 1-2 numbered lists (for step-by-step content) somewhere in the body. Each bullet/number item should be 1-2 sentences max. Lists should break up sections naturally, not be forced.
- Pull quotes: include 1-2 centerpiece pull quotes in the body (this article is 1,500+ words, so they're mandatory). Format each EXACTLY like this, using literal markdown blockquote lines:
  > **"Your powerful statement here."**
  >
  > *Make this line impactful*
  Pull quotes should feel like a visual pause point — pull a genuinely striking line from the surrounding content, don't invent a generic filler quote.

Respond in EXACTLY this format — not JSON, this exact plain-text structure, because it gets parsed programmatically by splitting on the delimiter line:

TITLE: <the article title, one line, no quotes>
META_DESCRIPTION: <the meta description, one line, no quotes, aim for exactly 480 characters, must be between 450 and 500 — count carefully, this is checked>
===MARKDOWN===
<the full article markdown starts here, beginning with a single # H1, continuing to the end of your response — no closing delimiter needed>`;

  const rawText = await generateTextChecked(prompt, { maxTokens: 16000 }, buildMockDelimitedText(mockValue));
  const result = parseArticleResponse(rawText);

  // Deterministic safety net — don't rely on the model hitting the
  // character range precisely, since it sometimes runs short.
  return { ...result, metaDescription: fitMetaDescription(result.metaDescription) };
}
