import type { NextApiRequest, NextApiResponse } from "next";
import { generateJSON } from "../../../utils/anthropic";
import { stripHtml } from "../../../utils/richText";

export interface SubjectOption {
  subject: string;
  previewText: string;
}

const MOCK: { options: SubjectOption[] } = {
  options: [
    { subject: "[Mock] You're invited this Thursday", previewText: "A quick note from the ATLAS team…" },
    { subject: "[Mock] Something new at ATLAS", previewText: "Here's what's coming up this month." },
  ],
};

// Step 3's "Generate" button: 5 subject lines, each with a matching inbox
// preview line, from a short brief (and the body, if already written).
export default async function handler(req: NextApiRequest, res: NextApiResponse<{ options: SubjectOption[] } | { error: string }>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const brief = typeof req.body?.brief === "string" ? req.body.brief.trim() : "";
  const bodyText = typeof req.body?.body_html === "string" ? stripHtml(req.body.body_html).slice(0, 4000) : "";
  const fromName = typeof req.body?.from_name === "string" ? req.body.from_name.trim() : "";
  if (!brief && !bodyText) {
    return res.status(400).json({ error: "Describe what the email is about (or write the content first)." });
  }

  const prompt = `You're writing email subject lines for ATLAS Network, a members community of entrepreneurs and ambitious young professionals (atlasnetwork.club).

Sender name shown in the inbox: ${fromName || "ATLAS Network"}
What the email is about: ${brief || "(see content below)"}
${bodyText ? `Email content:\n"""\n${bodyText}\n"""` : ""}

Write 5 distinct subject line options, each paired with a preview line (the grey snippet shown after the subject in the inbox).
- Subject: under 60 characters, specific and human, no clickbait, no ALL CAPS, at most one emoji and only if it fits.
- Preview line: 40–110 characters, complements the subject instead of repeating it.
- Vary the angle (direct, curiosity, benefit, personal, timely).
- Never invent facts not given above — no made-up names, pronouns/genders, numbers, dates, prices, scarcity ("spots are limited") or claims. If a detail is unknown, leave it out.

Return JSON: {"options":[{"subject":"...","previewText":"..."}]}`;

  try {
    const result = await generateJSON<{ options: SubjectOption[] }>(prompt, MOCK, { maxTokens: 3000 });
    const options = (result.options ?? []).filter((o) => o && typeof o.subject === "string").slice(0, 5);
    if (options.length === 0) throw new Error("No subject lines came back");
    return res.status(200).json({ options });
  } catch (error) {
    console.error("generate subjects failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Couldn't generate subject lines: ${message}` });
  }
}
