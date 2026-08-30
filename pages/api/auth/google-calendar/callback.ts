import type { NextApiRequest, NextApiResponse } from "next";
import { exchangeGoogleCalendarCode } from "../../../../utils/googleCalendar";

function readCookie(req: NextApiRequest, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const match = header.split("; ").find((c) => c.startsWith(`${name}=`));
  return match?.split("=")[1];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(302, `/calendar?gcal_error=${encodeURIComponent(String(error))}`);
  }

  const expectedState = readCookie(req, "gcal_oauth_state");
  if (!state || state !== expectedState) {
    return res.redirect(302, "/calendar?gcal_error=Invalid+OAuth+state");
  }
  if (typeof code !== "string") {
    return res.redirect(302, "/calendar?gcal_error=Missing+authorization+code");
  }

  try {
    await exchangeGoogleCalendarCode(code);
    res.setHeader("Set-Cookie", "gcal_oauth_state=; Path=/; HttpOnly; Max-Age=0");
    res.redirect(302, "/calendar?gcal_connected=1");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.redirect(302, `/calendar?gcal_error=${encodeURIComponent(message)}`);
  }
}
