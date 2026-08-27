import { generateJSON } from "./anthropic";
import { ResearchQuery } from "./webSearch";

export interface FAQItem {
  question: string;
  answer: string;
}

export interface BlogOutline {
  hook: string;
  quickAnswer: string;
  topicBreakdown: string[];
  example: string;
  faqs: FAQItem[];
  takeaways: string[];
  cta: string;
}

export interface OutlineGenerationResult {
  outline: BlogOutline;
}

interface GenerateOutlineInput {
  categoryLabel: string;
  topic: string;
  keywords: string[];
  research: ResearchQuery[];
}

function buildMockResult({ categoryLabel, topic }: GenerateOutlineInput): OutlineGenerationResult {
  return {
    outline: {
      hook: `[MOCK] Most people get "${topic}" wrong.\n\nNobody tells you why.\n\nHere's what the ${categoryLabel.toLowerCase()} research actually says.`,
      quickAnswer: `[MOCK] The short answer: ${topic} comes down to a few repeatable habits backed by current ${categoryLabel.toLowerCase()} research — this article breaks them down.`,
      topicBreakdown: [
        "Why this matters now — framing the problem in today's context",
        "The core framework — the 3-4 steps that actually move the needle",
        "Common mistakes — what most people get wrong",
        "How to apply it this week — a concrete starting point",
      ],
      example: `[MOCK] A short case-study style example showing "${topic}" applied in a real ${categoryLabel.toLowerCase()} scenario.`,
      faqs: [
        { question: `What is the fastest way to get started with ${topic}?`, answer: "[MOCK] Start with the single highest-leverage step outlined above." },
        { question: `Is ${topic} relevant for beginners?`, answer: "[MOCK] Yes — the framework scales down to a beginner-friendly first step." },
        { question: `How long until I see results?`, answer: "[MOCK] Most people notice early signals within a few weeks of consistent effort." },
        { question: `What tools or resources help most?`, answer: "[MOCK] A simple tracking habit outperforms most specialized tools." },
        { question: `What's the biggest mistake to avoid?`, answer: "[MOCK] Trying to do everything at once instead of one repeatable step." },
      ],
      takeaways: [
        "[MOCK] Consistency beats intensity for this topic.",
        "[MOCK] Start with one small, repeatable action.",
        "[MOCK] Track progress weekly, not daily.",
      ],
      cta: "[MOCK] Ready to put this into practice? Start with step one today.",
    },
  };
}

export async function generateOutline(input: GenerateOutlineInput): Promise<OutlineGenerationResult> {
  const mockValue = buildMockResult(input);

  const researchSummary = input.research.length
    ? input.research
        .map((r) => `Query: ${r.query}\n${r.findings.map((f) => `- ${f}`).join("\n")}`)
        .join("\n\n")
    : "(no research findings available)";

  const prompt = `You are writing a blog article outline for atlasnetwork.club, optimized for ChatGPT Search, Claude Search, and Google AI Overviews.

Category: ${input.categoryLabel}
Topic / user prompt: ${input.topic}
Target keywords (from keyword research — weave these into the outline naturally): ${input.keywords.join(", ") || "(none provided)"}

Research findings:
${researchSummary}

Produce a structured outline with these exact sections:
- hook: 3-5 short, punchy, single-sentence statements that ease the reader in (never a dense paragraph). Each statement should stand alone and be no more than ~8 words. Separate each statement with two newline characters (\\n\\n) so it renders as its own line. Example shape: "Most men struggle with this.\\n\\nNobody talks about why.\\n\\nThe science is clear—here's what to do."
- quickAnswer: a direct 30-second answer to the core question/topic (2-4 sentences)
- topicBreakdown: an array of 4-6 subsection headers, each formatted as "Header — one-sentence description"
- example: one concrete example or mini case study illustrating the topic
- faqs: exactly 5 objects with "question" and "answer" fields, written for featured-snippet optimization
- takeaways: an array of 3-5 key takeaway bullet points
- cta: a single call-to-action sentence

Respond with ONLY valid JSON in this exact shape, no markdown fences, no commentary:
{"outline": {"hook": "...", "quickAnswer": "...", "topicBreakdown": ["..."], "example": "...", "faqs": [{"question": "...", "answer": "..."}], "takeaways": ["..."], "cta": "..."}}`;

  return generateJSON<OutlineGenerationResult>(prompt, mockValue, {
    maxTokens: 4096,
    temperature: 0.7,
  });
}
