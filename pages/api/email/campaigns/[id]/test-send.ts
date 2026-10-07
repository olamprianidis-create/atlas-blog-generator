import type { NextApiRequest, NextApiResponse } from "next";
import { isEmailSendingConfigured, sendTestEmail } from "../../../../../utils/emailSend";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sends the campaign as currently saved to one address, "[Test]" subject.
export default async function handler(req: NextApiRequest, res: NextApiResponse<{ ok: true } | { error: string }>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { id } = req.query;
  if (typeof id !== "string" || !id) return res.status(400).json({ error: "Missing campaign id" });
  const to = typeof req.body?.to === "string" ? req.body.to.trim() : "";
  if (!EMAIL_PATTERN.test(to)) return res.status(400).json({ error: "Enter a valid email address" });
  if (!isEmailSendingConfigured()) {
    return res.status(503).json({ error: "Email sending isn't set up — RESEND_API_KEY is missing." });
  }

  try {
    await sendTestEmail(id, to);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("test send failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Test send failed: ${message}` });
  }
}
