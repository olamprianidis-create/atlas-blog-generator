import { google } from "googleapis";
import { getServiceClient } from "./supabase";

// Setup required in Google Cloud Console before this works:
// 1. Create a project, enable "YouTube Data API v3".
// 2. Create an OAuth 2.0 Client ID (type: Web application).
// 3. Add ${SITE_URL}/api/auth/youtube/callback as an authorized redirect URI.
// 4. Set YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / SITE_URL in .env.local
//    and Vercel. The app must also pass Google's OAuth verification (or stay
//    in "Testing" mode with the ATLAS account added as a test user) before
//    tokens issued to that account will keep working past 7 days.
const SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];

function getOAuthClient() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const siteUrl = process.env.SITE_URL;

  if (!clientId || !clientSecret || !siteUrl) {
    throw new Error(
      "YouTube isn't configured yet (missing YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / SITE_URL)."
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, `${siteUrl}/api/auth/youtube/callback`);
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
    .select("access_token, refresh_token")
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
      body: videoResponse.body,
    },
  });

  const videoId = insertResponse.data.id;
  if (!videoId) {
    throw new Error("YouTube didn't return a video ID after upload.");
  }

  if (input.thumbnailUrl) {
    const thumbResponse = await fetch(input.thumbnailUrl);
    if (thumbResponse.ok && thumbResponse.body) {
      await youtube.thumbnails.set({
        videoId,
        media: { body: thumbResponse.body },
      });
    }
  }

  return videoId;
}
