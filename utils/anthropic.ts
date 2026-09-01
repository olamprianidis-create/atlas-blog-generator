import Anthropic from "@anthropic-ai/sdk";

const MOCK_MODE = process.env.ANTHROPIC_MOCK_MODE === "true";
const apiKey = process.env.ANTHROPIC_API_KEY;

if (!MOCK_MODE && !apiKey) {
  throw new Error("Missing ANTHROPIC_API_KEY in environment variables");
}

const client = MOCK_MODE ? null : new Anthropic({ apiKey });

const DEFAULT_MODEL = "claude-sonnet-5";
// Used for short, low-reasoning calls (web-search retrieval, topic-phrase
// extraction) that don't need full Sonnet-level reasoning — same quality
// for these tasks, meaningfully cheaper per call.
export const CLASSIFICATION_MODEL = "claude-haiku-4-5-20251001";
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
  // Large, byte-for-byte-reused text (e.g. a prompt template) to send as
  // its own cached content block ahead of the actual prompt, so repeated
  // calls that share this same context aren't billed full price for it
  // every time. Only helps once the block is at/above Anthropic's cache
  // minimum (1024 tokens for Sonnet) — smaller blocks are silently sent
  // uncached instead of erroring.
  cachedContext?: string;
}

const MOCK_RESPONSE =
  "[MOCK RESPONSE — ANTHROPIC_MOCK_MODE=true, no API call was made, no cost incurred]\n\n" +
  "This is placeholder text standing in for a generated blog outline/article. " +
  "Set ANTHROPIC_MOCK_MODE=false (and add a real ANTHROPIC_API_KEY with credit) to get real output.";

// Central wrapper for all Anthropic calls — handles retries with
// exponential backoff so callers don't each reimplement it. Pass
// `mockValue` to get a realistic placeholder in mock mode instead of
// the generic canned response.
interface TextWithMeta {
  text: string;
  truncated: boolean;
}

async function generateTextWithMeta(prompt: string, options: GenerateOptions): Promise<TextWithMeta> {
  const {
    model = DEFAULT_MODEL,
    maxTokens = 4096,
    system,
    cachedContext,
  } = options;

  const content = cachedContext
    ? [
        {
          type: "text" as const,
          text: cachedContext,
          cache_control: { type: "ephemeral" as const },
        },
        { type: "text" as const, text: prompt },
      ]
    : prompt;

  // `temperature` is deprecated/rejected for this model — deliberately
  // not forwarded to the API even if a caller passes it in `options`.
  return withRetry(async () => {
    const response = await client!.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "";
    return { text, truncated: response.stop_reason === "max_tokens" };
  });
}

export async function generateText(
  prompt: string,
  options: GenerateOptions = {},
  mockValue: string = MOCK_RESPONSE
): Promise<string> {
  if (MOCK_MODE) {
    return mockValue;
  }

  const { text } = await generateTextWithMeta(prompt, options);
  return text;
}

// Runs a single live web search via Claude's server-side web_search tool
// and returns a handful of plain-text findings for the given query.
// Defaults to the cheaper classification-tier model — summarizing search
// results into bullet points doesn't need full Sonnet-level reasoning.
export async function webSearch(
  query: string,
  model: string = CLASSIFICATION_MODEL
): Promise<string[]> {
  if (MOCK_MODE) {
    return [
      `[MOCK] Placeholder finding #1 for "${query}" — no live search performed.`,
      `[MOCK] Placeholder finding #2 for "${query}".`,
    ];
  }

  return withRetry(async () => {
    const response = await client!.messages.create({
      model,
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

// Transcribes/describes an uploaded reference image (PNG/JPG) into plain
// text — chart data, screenshotted text, infographic content, etc. — so
// it can be woven into research context the same way an extracted PDF/
// docx's text is (see utils/documentExtraction.ts). Uses the cheaper
// classification-tier model since this is transcription, not reasoning;
// a single image costs roughly the same as reading a page of text (image
// tokens scale with pixel count, not a flat per-call fee), and maxTokens
// is capped so one image can't balloon the bill.
export async function describeImage(base64Data: string, mediaType: string, filename: string): Promise<string> {
  if (MOCK_MODE) {
    return `[MOCK] Placeholder description of uploaded image "${filename}" — no live vision call was made.`;
  }

  return withRetry(async () => {
    const response = await client!.messages.create({
      model: CLASSIFICATION_MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType as "image/png" | "image/jpeg", data: base64Data },
            },
            {
              type: "text",
              text: "Transcribe and describe everything relevant in this image for use as research material for a blog article: any visible text verbatim, chart/graph data and labels, statistics, and a plain description of what the image shows. Be concrete and specific, not vague. Plain text only, no markdown formatting.",
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock && "text" in textBlock ? textBlock.text.trim() : "";
  });
}

// Like generateText, but throws a clear error if the response got cut
// off by hitting max_tokens instead of silently returning partial text.
// Useful for callers that need a complete response to parse (JSON,
// delimited formats) rather than free-form prose.
export async function generateTextChecked(
  prompt: string,
  options: GenerateOptions = {},
  mockValue: string = MOCK_RESPONSE
): Promise<string> {
  if (MOCK_MODE) {
    return mockValue;
  }

  const { text, truncated } = await generateTextWithMeta(prompt, options);

  if (truncated) {
    throw new Error(
      `Anthropic response was truncated (hit max_tokens=${options.maxTokens ?? 4096}) before completing. Increase maxTokens for this call.`
    );
  }

  return text;
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

  const text = await generateTextChecked(prompt, {
    ...options,
    system:
      options.system ??
      "You respond with strictly valid JSON only, matching the requested shape exactly. No markdown code fences, no commentary outside the JSON object.",
  });

  // Strip markdown code fences the model may add despite instructions
  // not to (```json ... ``` or plain ``` ... ```).
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error(
      `Anthropic response did not contain valid JSON. First 300 chars: ${stripped.slice(0, 300)}`
    );
  }

  const candidate = stripped.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(candidate) as T;
  } catch (error) {
    const parseMessage = error instanceof Error ? error.message : "unknown parse error";
    throw new Error(
      `Anthropic response was not valid JSON (${parseMessage}). Length: ${candidate.length}. Last 300 chars: ${candidate.slice(-300)}`
    );
  }
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
