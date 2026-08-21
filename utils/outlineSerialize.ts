import type { BlogOutline } from "./outline";

const SECTION_ORDER = ["HOOK", "QUICK ANSWER", "TOPIC BREAKDOWN", "EXAMPLE", "FAQS", "TAKEAWAYS", "CALL TO ACTION"] as const;

// Turns a structured outline into one freeform text block the user can
// edit however they like (add/delete/rewrite anything), then parsed back
// into BlogOutline before article generation.
export function serializeOutline(outline: BlogOutline): string {
  const faqsText = outline.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");

  return [
    `HOOK:\n${outline.hook}`,
    `QUICK ANSWER:\n${outline.quickAnswer}`,
    `TOPIC BREAKDOWN:\n${outline.topicBreakdown.map((t) => `- ${t}`).join("\n")}`,
    `EXAMPLE:\n${outline.example}`,
    `FAQS:\n${faqsText}`,
    `TAKEAWAYS:\n${outline.takeaways.map((t) => `- ${t}`).join("\n")}`,
    `CALL TO ACTION:\n${outline.cta}`,
  ].join("\n\n");
}

function extractSection(text: string, header: string): string {
  const index = SECTION_ORDER.indexOf(header as (typeof SECTION_ORDER)[number]);
  const nextHeaders = SECTION_ORDER.slice(index + 1);

  const startPattern = new RegExp(`^${header}:\\s*\\n?`, "im");
  const startMatch = startPattern.exec(text);
  if (!startMatch) return "";

  const startIndex = startMatch.index + startMatch[0].length;
  let endIndex = text.length;

  for (const nextHeader of nextHeaders) {
    const nextPattern = new RegExp(`^${nextHeader}:\\s*$`, "im");
    const nextMatch = nextPattern.exec(text.slice(startIndex));
    if (nextMatch) {
      endIndex = Math.min(endIndex, startIndex + nextMatch.index);
    }
  }

  return text.slice(startIndex, endIndex).trim();
}

function parseListLines(section: string): string[] {
  return section
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

// Parses the user-edited text block back into a BlogOutline. Tolerant of
// missing/reordered sections since a human, not the model, is editing it —
// falls back to empty values rather than throwing on a malformed edit.
export function parseOutlineText(text: string): BlogOutline {
  const faqsSection = extractSection(text, "FAQS");
  const faqBlocks = faqsSection.split(/\n\s*\n/).filter(Boolean);
  const faqs = faqBlocks
    .map((block) => {
      const questionMatch = /^Q:\s*(.+)$/im.exec(block);
      const answerMatch = /^A:\s*(.+)$/im.exec(block);
      if (!questionMatch || !answerMatch) return null;
      return { question: questionMatch[1].trim(), answer: answerMatch[1].trim() };
    })
    .filter((f): f is { question: string; answer: string } => f !== null);

  return {
    hook: extractSection(text, "HOOK"),
    quickAnswer: extractSection(text, "QUICK ANSWER"),
    topicBreakdown: parseListLines(extractSection(text, "TOPIC BREAKDOWN")),
    example: extractSection(text, "EXAMPLE"),
    faqs,
    takeaways: parseListLines(extractSection(text, "TAKEAWAYS")),
    cta: extractSection(text, "CALL TO ACTION"),
  };
}
