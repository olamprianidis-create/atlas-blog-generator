import type { NextApiRequest, NextApiResponse } from "next";
import { generateJSON } from "../../../utils/anthropic";
import { errorMessage } from "../../../utils/errorMessage";

const MOCK = {
  html: "<p>[Mock] Hi there,</p><p>This is placeholder email content — set ANTHROPIC_MOCK_MODE=false for real output.</p><p>— The ATLAS team</p>",
};

// Step 4's "Generate" button: drafts the email body as simple HTML the
// editor can show and the email template can style.
export default async function handler(req: NextApiRequest, res: NextApiResponse<{ html: string } | { error: string }>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const brief = typeof req.body?.brief === "string" ? req.body.brief.trim() : "";
  const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
  const fromName = typeof req.body?.from_name === "string" ? req.body.from_name.trim() : "";
  if (!brief) return res.status(400).json({ error: "Describe what the email should say." });

  const prompt = `You're writing a marketing/community email for ATLAS Network, a members community of entrepreneurs and ambitious young professionals (atlasnetwork.club).

Sent by: ${fromName || "ATLAS Network"}
Subject line: ${subject || "(not chosen yet)"}
What it should say: ${brief}

Guidelines:
- Warm, direct, personal — written by a real person, not a corporation. Short paragraphs (1–3 sentences).
- 120–250 words unless the brief clearly needs more.
- Open with a greeting like "Hi there," (no name merge tags).
- One clear call to action. If a link is mentioned in the brief, use it as an <a href> on descriptive text; never invent URLs.
- Sign off with the sender's first name or "The ATLAS team".
- Never invent facts not given above — no made-up names, pronouns/genders, numbers, dates, prices, scarcity ("spots are limited") or claims. If a detail is unknown, leave it out.
- Do NOT include an unsubscribe line, address, or header — the template adds those.

Format: HTML using only <p>, <h2>, <strong>, <em>, <ul>, <ol>, <li>, <a href>, <br>. No inline styles, no images.

Return JSON: {"html":"..."}`;

  try {
    const result = await generateJSON<{ html: string }>(prompt, MOCK, { maxTokens: 4000 });
    if (typeof result.html !== "string" || !result.html.trim()) throw new Error("No content came back");
    return res.status(200).json({ html: result.html });
  } catch (error) {
    console.error("generate body failed:", error);
    const message = errorMessage(error);
    return res.status(502).json({ error: `Couldn't generate the email: ${message}` });
  }
}
