import { google } from "googleapis";
import { Readable } from "stream";
import { getServiceClient } from "./supabase";

// Setup required in Google Cloud Console before this works:
// 1. Create a project, enable "YouTube Data API v3".
// 2. Create an OAuth 2.0 Client ID (type: Web application).
// 3. Add ${APP_URL}/api/auth/youtube/callback as an authorized redirect URI.
// 4. Set YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / APP_URL in .env.local
//    and Vercel. APP_URL is this app's own deployed URL (Stat.ATLAS), not
//    the ATLAS Website's atlasnetwork.club (see utils/site.ts's SITE_URL,
//    a different, unrelated constant — same-sounding name, different app).
//    The app must also pass Google's OAuth verification (or stay in
//    "Testing" mode with the ATLAS account added as a test user) before
//    tokens issued to that account will keep working past 7 days.
const SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];

function getOAuthClient() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL;

  if (!clientId || !clientSecret || !appUrl) {
    throw new Error(
      "YouTube isn't configured yet (missing YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / APP_URL)."
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, `${appUrl}/api/auth/youtube/callback`);
}

export function getYoutubeAuthUrl(state: string): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function exchangeYoutubeCode(code: string): Promise<void> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) {
    throw new Error("Google didn't return an access token.");
  }

  const db = getServiceClient();
  const { error } = await db.from("platform_connections").upsert({
    platform: "youtube",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? undefined,
    expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    scope: tokens.scope ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function isYoutubeConnected(): Promise<boolean> {
  const db = getServiceClient();
  const { data } = await db
    .from("platform_connections")
    .select("platform")
    .eq("platform", "youtube")
    .maybeSingle();
  return !!data;
}

async function getAuthorizedClient() {
  const db = getServiceClient();
  const { data, error } = await db
    .from("platform_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("platform", "youtube")
    .maybeSingle();

  if (error) throw error;
  if (!data?.refresh_token) {
    throw new Error("YouTube isn't connected. Connect it from the Uploads page first.");
  }

  const client = getOAuthClient();
  client.setCredentials({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    // Without expiry_date, isTokenExpiring() assumes the token is never
    // expiring and getAccessToken() below would just hand back the stale
    // token as-is — this is what actually lets it detect staleness.
    expiry_date: data.expires_at ? new Date(data.expires_at).getTime() : undefined,
  });

  // Persist a refreshed access token so the next call doesn't need to
  // round-trip through Google again.
  client.on("tokens", async (tokens) => {
    if (!tokens.access_token) return;
    await db
      .from("platform_connections")
      .update({
        access_token: tokens.access_token,
        expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("platform", "youtube");
  });

  // google-auth-library's automatic retry-on-401 (which would normally
  // refresh a stale access token and retry the request) explicitly skips
  // any request whose body is a Readable stream — see oauth2client.js's
  // requestAsync: `isReadableStream` disables `mayRequireRefresh`. Video
  // uploads always send a Readable stream body (see uploadVideoToYoutube
  // below), so a stale access token would otherwise fail with "invalid
  // authentication credentials" on every upload with no retry. Forcing a
  // refresh here — before any request is made — avoids relying on that
  // disabled retry path.
  await client.getAccessToken();

  return client;
}

export interface YoutubeUploadInput {
  videoUrl: string;
  title: string;
  description?: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus: "public" | "unlisted" | "private";
  madeForKids: boolean;
  thumbnailUrl?: string;
}

export async function uploadVideoToYoutube(input: YoutubeUploadInput): Promise<string> {
  const auth = await getAuthorizedClient();
  const youtube = google.youtube({ version: "v3", auth });

  const videoResponse = await fetch(input.videoUrl);
  if (!videoResponse.ok || !videoResponse.body) {
    throw new Error(`Couldn't fetch the video file from storage (${videoResponse.status}).`);
  }

  // googleapis' upload path expects a Node.js Readable (it calls .pipe()
  // internally) — fetch()'s response.body is a Web Streams API
  // ReadableStream, which has no .pipe() method, hence "part.body.pipe is
  // not a function". Readable.fromWeb() bridges the two.
  const videoStream = Readable.fromWeb(videoResponse.body as import("stream/web").ReadableStream);

  const insertResponse = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: input.title,
        description: input.description || undefined,
        tags: input.tags && input.tags.length > 0 ? input.tags : undefined,
        categoryId: input.categoryId || undefined,
      },
      status: {
        privacyStatus: input.privacyStatus,
        selfDeclaredMadeForKids: input.madeForKids,
      },
    },
    media: {
      body: videoStream,
    },
  });

  const videoId = insertResponse.data.id;
  if (!videoId) {
    throw new Error("YouTube didn't return a video ID after upload.");
  }

  if (input.thumbnailUrl) {
    const thumbResponse = await fetch(input.thumbnailUrl);
    if (thumbResponse.ok && thumbResponse.body) {
      const thumbStream = Readable.fromWeb(thumbResponse.body as import("stream/web").ReadableStream);
      await youtube.thumbnails.set({
        videoId,
        media: { body: thumbStream },
      });
    }
  }

  return videoId;
}
