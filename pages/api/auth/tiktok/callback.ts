import type { NextApiRequest, NextApiResponse } from "next";
import { exchangeTiktokCode } from "../../../../utils/tiktok";

function readCookie(req: NextApiRequest, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const match = header.split("; ").find((c) => c.startsWith(`${name}=`));
  return match?.split("=")[1];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(302, `/uploads?tiktok_error=${encodeURIComponent(String(error))}`);
  }

  const expectedState = readCookie(req, "tiktok_oauth_state");
  if (!state || state !== expectedState) {
    return res.redirect(302, "/uploads?tiktok_error=Invalid+OAuth+state");
  }
  if (typeof code !== "string") {
    return res.redirect(302, "/uploads?tiktok_error=Missing+authorization+code");
  }

  try {
    await exchangeTiktokCode(code);
    res.setHeader("Set-Cookie", "tiktok_oauth_state=; Path=/; HttpOnly; Max-Age=0");
    res.redirect(302, "/uploads?tiktok_connected=1");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.redirect(302, `/uploads?tiktok_error=${encodeURIComponent(message)}`);
  }
}
