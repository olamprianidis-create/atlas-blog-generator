import type { NextApiRequest, NextApiResponse } from "next";
import { exchangeYoutubeCode } from "../../../../utils/youtube";

function readCookie(req: NextApiRequest, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const match = header.split("; ").find((c) => c.startsWith(`${name}=`));
  return match?.split("=")[1];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(302, `/uploads?youtube_error=${encodeURIComponent(String(error))}`);
  }

  const expectedState = readCookie(req, "youtube_oauth_state");
  if (!state || state !== expectedState) {
    return res.redirect(302, "/uploads?youtube_error=Invalid+OAuth+state");
  }
  if (typeof code !== "string") {
    return res.redirect(302, "/uploads?youtube_error=Missing+authorization+code");
  }

  try {
    await exchangeYoutubeCode(code);
    res.setHeader("Set-Cookie", "youtube_oauth_state=; Path=/; HttpOnly; Max-Age=0");
    res.redirect(302, "/uploads?youtube_connected=1");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.redirect(302, `/uploads?youtube_error=${encodeURIComponent(message)}`);
  }
}
