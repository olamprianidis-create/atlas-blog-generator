import { getServiceClient } from "./supabase";

// Setup required in the TikTok for Developers portal before this works:
// 1. Create an app, add the "Content Posting API" product.
// 2. Add ${SITE_URL}/api/auth/tiktok/callback as a redirect URI.
// 3. Verify the domain in SITE_URL (Content Posting API > "Direct Post" via
//    PULL_FROM_URL requires this, or uploads will be rejected).
// 4. "Direct Post" to a public account requires TikTok's app audit —
//    until that's approved, tokens only work for the developer's own
//    sandboxed TikTok account. Set TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET
//    / SITE_URL in .env.local and Vercel.
const SCOPES = "video.publish,video.upload";
const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const PUBLISH_INIT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/";

function requireEnv() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const siteUrl = process.env.SITE_URL;

  if (!clientKey || !clientSecret || !siteUrl) {
    throw new Error(
      "TikTok isn't configured yet (missing TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET / SITE_URL)."
    );
  }
  return { clientKey, clientSecret, redirectUri: `${siteUrl}/api/auth/tiktok/callback` };
}

export function getTiktokAuthUrl(state: string): string {
  const { clientKey, redirectUri } = requireEnv();
  const params = new URLSearchParams({
    client_key: clientKey,
    scope: SCOPES,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

interface TiktokTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  open_id: string;
  error?: string;
  error_description?: string;
}

export async function exchangeTiktokCode(code: string): Promise<void> {
  const { clientKey, clientSecret, redirectUri } = requireEnv();

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  const data = (await response.json()) as TiktokTokenResponse;
  if (!response.ok || data.error) {
    throw new Error(data.error_description || `TikTok token exchange failed (${response.status}).`);
  }

  const db = getServiceClient();
  const { error } = await db.from("platform_connections").upsert({
    platform: "tiktok",
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    account_label: data.open_id,
    scope: data.scope,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function isTiktokConnected(): Promise<boolean> {
  const db = getServiceClient();
  const { data } = await db
    .from("platform_connections")
    .select("platform")
    .eq("platform", "tiktok")
    .maybeSingle();
  return !!data;
}

async function getValidAccessToken(): Promise<string> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("platform_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("platform", "tiktok")
    .maybeSingle();

  if (error) throw error;
  if (!data?.refresh_token) {
    throw new Error("TikTok isn't connected. Connect it from the Uploads page first.");
  }

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) {
    return data.access_token;
  }

  const { clientKey, clientSecret } = requireEnv();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: data.refresh_token,
    }),
  });
  const refreshed = (await response.json()) as TiktokTokenResponse;
  if (!response.ok || refreshed.error) {
    throw new Error(refreshed.error_description || "Failed to refresh the TikTok access token.");
  }

  await db
    .from("platform_connections")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("platform", "tiktok");

  return refreshed.access_token;
}

export interface TiktokPublishInput {
  videoUrl: string;
  title: string;
  privacyLevel: string;
  disableComment: boolean;
  disableDuet: boolean;
  disableStitch: boolean;
  coverTimestampMs: number;
}

export async function publishVideoToTiktok(input: TiktokPublishInput): Promise<string> {
  const accessToken = await getValidAccessToken();

  const response = await fetch(PUBLISH_INIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: input.title,
        privacy_level: input.privacyLevel,
        disable_comment: input.disableComment,
        disable_duet: input.disableDuet,
        disable_stitch: input.disableStitch,
        video_cover_timestamp_ms: input.coverTimestampMs,
      },
      // PULL_FROM_URL lets TikTok fetch the video directly from our Vercel
      // Blob URL instead of us streaming raw bytes through a chunked
      // upload — simplest option, but requires SITE_URL's domain to be
      // verified in the TikTok developer portal first.
      source_info: {
        source: "PULL_FROM_URL",
        video_url: input.videoUrl,
      },
    }),
  });

  const data = await response.json();
  if (!response.ok || data.error?.code !== "ok") {
    throw new Error(data.error?.message || `TikTok publish failed (${response.status}).`);
  }

  return data.data.publish_id as string;
}
