import type { NextApiRequest, NextApiResponse } from "next";
import { parseNewsletterSignup, signUpForNewsletter } from "../../../utils/newsletterSignup";

// Public "Join Our Newsletter" form on the ATLAS Website landing page. The
// Website forwards the form here server-side (its /api/newsletter route),
// same pattern as unsubscribe.ts.
export default async function handler(req: NextApiRequest, res: NextApiResponse<{ ok: true } | { error: string }>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const parsed = parseNewsletterSignup(req.body);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });

  try {
    await signUpForNewsletter(parsed.input);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("newsletter signup failed:", error);
    return res.status(502).json({ error: "Something went wrong — please try again." });
  }
}
