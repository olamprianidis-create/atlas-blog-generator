import { getServiceClient } from "./supabase";

// Setup required in the LinkedIn Developer Portal before this works:
// 1. Create an app at https://www.linkedin.com/developers/apps.
// 2. Under "Products", add both "Sign In with LinkedIn using OpenID
//    Connect" and "Share on LinkedIn" (self-serve, no review needed for
//    either — unlike posting to an Organization Page, which needs
//    w_organization_social + Marketing Developer Platform partner
//    approval; this integration only posts as your personal profile).
// 3. Add ${APP_URL}/api/auth/linkedin/callback as an authorized redirect
//    URL (Auth tab). APP_URL is this app's own deployed URL, not the
//    ATLAS Website's atlasnetwork.club (see utils/site.ts's SITE_URL).
// 4. Set LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET / APP_URL in
//    .env.local and Vercel.
// 5. LinkedIn access tokens last 60 days and, by default, don't come with
//    a refresh token — reconnecting periodically (from the Published
//    page) is the expected flow unless you separately apply for
//    LinkedIn's "Programmatic Refresh Tokens" product.
const SCOPES = "openid profile w_member_social";
const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const POSTS_URL = "https://api.linkedin.com/rest/posts";
// LinkedIn requires every REST API call to pin a version — bump this
// periodically; LinkedIn deprecates versions roughly a year after release.
const LINKEDIN_API_VERSION = "202505";

function requireEnv() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const appUrl = process.env.APP_URL;

  if (!clientId || !clientSecret || !appUrl) {
    throw new Error(
      "LinkedIn isn't configured yet (missing LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET / APP_URL)."
    );
  }
  return { clientId, clientSecret, redirectUri: `${appUrl}/api/auth/linkedin/callback` };
}

export function getLinkedinAuthUrl(state: string): string {
  const { clientId, redirectUri } = requireEnv();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

interface LinkedinTokenResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

export async function exchangeLinkedinCode(code: string): Promise<void> {
  const { clientId, clientSecret, redirectUri } = requireEnv();

  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const tokenData = (await tokenResponse.json()) as LinkedinTokenResponse;
  if (!tokenResponse.ok || tokenData.error) {
    throw new Error(tokenData.error_description || `LinkedIn token exchange failed (${tokenResponse.status}).`);
  }

  const userInfoResponse = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userInfo = await userInfoResponse.json();
  if (!userInfoResponse.ok || !userInfo.sub) {
    throw new Error("Couldn't fetch the LinkedIn member ID after authorizing.");
  }

  const db = getServiceClient();
  const { error } = await db.from("platform_connections").upsert({
    platform: "linkedin",
    access_token: tokenData.access_token,
    refresh_token: null,
    expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
    account_label: `urn:li:person:${userInfo.sub}`,
    scope: tokenData.scope ?? SCOPES,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function isLinkedinConnected(): Promise<boolean> {
  const db = getServiceClient();
  const { data } = await db
    .from("platform_connections")
    .select("platform, expires_at")
    .eq("platform", "linkedin")
    .maybeSingle();
  if (!data) return false;
  return !data.expires_at || new Date(data.expires_at).getTime() > Date.now();
}

export interface LinkedinPostInput {
  title: string;
  summary?: string;
  articleUrl: string;
}

export async function postArticleToLinkedin(input: LinkedinPostInput): Promise<string> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("platform_connections")
    .select("access_token, account_label, expires_at")
    .eq("platform", "linkedin")
    .maybeSingle();

  if (error) throw error;
  if (!data?.access_token || !data.account_label) {
    throw new Error("LinkedIn isn't connected. Connect it from the Published page first.");
  }
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    // No refresh token by default (see the setup note above) — the admin
    // has to click "Connect" again rather than this refreshing silently.
    throw new Error("LinkedIn's connection expired. Reconnect it from the Published page.");
  }

  const response = await fetch(POSTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.access_token}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": LINKEDIN_API_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: data.account_label,
      commentary: input.title,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: {
        article: {
          source: input.articleUrl,
          title: input.title,
          description: input.summary,
        },
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LinkedIn post failed (${response.status}): ${body}`);
  }

  return response.headers.get("x-restli-id") || response.headers.get("x-linkedin-id") || "posted";
}
