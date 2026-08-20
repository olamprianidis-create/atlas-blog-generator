import Anthropic from "@anthropic-ai/sdk";

const MOCK_MODE = process.env.ANTHROPIC_MOCK_MODE === "true";
const apiKey = process.env.ANTHROPIC_API_KEY;

if (!MOCK_MODE && !apiKey) {
  throw new Error("Missing ANTHROPIC_API_KEY in environment variables");
}

const client = MOCK_MODE ? null : new Anthropic({ apiKey });

const DEFAULT_MODEL = "claude-sonnet-5";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const isRetryable =
        error instanceof Anthropic.APIError &&
        (error.status === 429 || (error.status ?? 0) >= 500);

      if (!isRetryable || attempt === MAX_RETRIES - 1) {
        throw error;
      }

      await sleep(BASE_DELAY_MS * 2 ** attempt);
    }
  }

  throw lastError;
}

export interface GenerateOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
}

const MOCK_RESPONSE =
  "[MOCK RESPONSE — ANTHROPIC_MOCK_MODE=true, no API call was made, no cost incurred]\n\n" +
  "This is placeholder text standing in for a generated blog outline/article. " +
  "Set ANTHROPIC_MOCK_MODE=false (and add a real ANTHROPIC_API_KEY with credit) to get real output.";

// Central wrapper for all Anthropic calls — handles retries with
// exponential backoff so callers don't each reimplement it. Pass
// `mockValue` to get a realistic placeholder in mock mode instead of
// the generic canned response.
export async function generateText(
  prompt: string,
  options: GenerateOptions = {},
  mockValue: string = MOCK_RESPONSE
): Promise<string> {
  if (MOCK_MODE) {
    return mockValue;
  }

  const {
    model = DEFAULT_MODEL,
    maxTokens = 4096,
    system,
  } = options;

  // `temperature` is deprecated/rejected for this model — deliberately
  // not forwarded to the API even if a caller passes it in `options`.
  return withRetry(async () => {
    const response = await client!.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock && "text" in textBlock ? textBlock.text : "";
  });
}

// Runs a single live web search via Claude's server-side web_search tool
// and returns a handful of plain-text findings for the given query.
export async function webSearch(query: string): Promise<string[]> {
  if (MOCK_MODE) {
    return [
      `[MOCK] Placeholder finding #1 for "${query}" — no live search performed.`,
      `[MOCK] Placeholder finding #2 for "${query}".`,
    ];
  }

  return withRetry(async () => {
    const response = await client!.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1024,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
      messages: [
        {
          role: "user",
          content: `Search the web for: ${query}\n\nReturn 2-3 concrete, specific findings (statistics, trends, or expert statements) as a plain bullet list. No preamble, no extra commentary — just the bullets.`,
        },
      ],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => ("text" in block ? block.text : ""))
      .join("\n");

    return text
      .split("\n")
      .map((line) => line.replace(/^[-*•\d.]+\s*/, "").trim())
      .filter(Boolean);
  });
}

// Requests a JSON response from Claude and parses it. `mockValue` is
// returned as-is in mock mode so callers can supply realistic placeholder
// data without any real API call being made.
export async function generateJSON<T>(
  prompt: string,
  mockValue: T,
  options: GenerateOptions = {}
): Promise<T> {
  if (MOCK_MODE) {
    return mockValue;
  }

  const text = await generateText(prompt, {
    ...options,
    system:
      options.system ??
      "You respond with strictly valid JSON only, matching the requested shape exactly. No markdown code fences, no commentary outside the JSON object.",
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("Anthropic response did not contain valid JSON");
  }

  return JSON.parse(jsonMatch[0]) as T;
}

export async function testConnection(): Promise<boolean> {
  if (MOCK_MODE) {
    console.log("(ANTHROPIC_MOCK_MODE=true — skipping real API call)");
    return true;
  }

  const reply = await generateText("Reply with exactly: OK", { maxTokens: 10 });
  return reply.trim().includes("OK");
}

export default client;
