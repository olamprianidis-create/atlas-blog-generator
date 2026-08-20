import { generateText } from "./anthropic";

const STOP_WORDS = new Set([
  "how", "should", "the", "a", "an", "is", "are", "do", "does", "of", "for",
  "to", "and", "or", "what", "why", "when", "think", "about", "on", "in",
  "at", "with", "be", "can", "will",
]);

// Mock-mode fallback: a naive keyword extraction so the search queries
// still read reasonably even with no real API call.
function buildMockPhrase(prompt: string): string {
  const words = prompt
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  const meaningful = words.filter((word) => !STOP_WORDS.has(word.toLowerCase()));
  const phrase = (meaningful.length ? meaningful : words).slice(0, 3).join(" ").toLowerCase();

  return phrase || "general topic";
}

// Extracts a short 2-4 word topic phrase from a free-form user prompt,
// used to build cleaner web search queries than the raw prompt would.
export async function extractTopicPhrase(prompt: string): Promise<string> {
  const trimmed = prompt.trim();

  if (!trimmed) {
    return "";
  }

  const instruction = `Extract a 2-4 word topic phrase from this prompt.
Return ONLY the phrase, nothing else.

Examples:
- "How should first-time founders think about fundraising?" → "fundraising for founders"
- "Are men sleeping enough?" → "men sleep quality"
- "72% of entrepreneurs report burnout" → "entrepreneur burnout"

Prompt: ${trimmed}`;

  const response = await generateText(
    instruction,
    { maxTokens: 20, temperature: 0 },
    buildMockPhrase(trimmed)
  );

  return response.trim().replace(/^["']|["']$/g, "");
}
