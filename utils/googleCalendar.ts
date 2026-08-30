import { google } from "googleapis";
import { getServiceClient } from "./supabase";

// Setup required in Google Cloud Console before this works:
// 1. Reuses the SAME OAuth client as YouTube (YOUTUBE_CLIENT_ID /
//    YOUTUBE_CLIENT_SECRET — see utils/youtube.ts) since it's the same
//    Google Cloud project ("ATLAS Content Uploader") issuing tokens for a
//    different Google API, not a separate app. Just enable "Google
//    Calendar API" in that same project.
// 2. Add ${APP_URL}/api/auth/google-calendar/callback as an additional
//    authorized redirect URI on that same OAuth client (Auth tab) — it
//    already has the YouTube callback URI, this adds a second one.
// 3. Add the Calendar scope to the OAuth consent screen's scopes (Data
//    Access tab) if using a "Testing" (unverified) app — same test-user
//    restriction as YouTube applies here.
const SCOPES = ["https://www.googleapis.com/auth/calendar"];

function getOAuthClient() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL;

  if (!clientId || !clientSecret || !appUrl) {
    throw new Error(
      "Google Calendar isn't configured yet (missing YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / APP_URL — the same Google OAuth client used for YouTube)."
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, `${appUrl}/api/auth/google-calendar/callback`);
}

export function getGoogleCalendarAuthUrl(state: string): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function exchangeGoogleCalendarCode(code: string): Promise<void> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) {
    throw new Error("Google didn't return an access token.");
  }

  const db = getServiceClient();
  const { error } = await db.from("platform_connections").upsert({
    platform: "google_calendar",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? undefined,
    expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    scope: tokens.scope ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

interface GoogleCalendarConnection {
  connected: boolean;
  selectedCalendarId: string | null;
}

export async function getGoogleCalendarConnection(): Promise<GoogleCalendarConnection> {
  const db = getServiceClient();
  const { data } = await db
    .from("platform_connections")
    .select("account_label")
    .eq("platform", "google_calendar")
    .maybeSingle();
  return { connected: !!data, selectedCalendarId: data?.account_label ?? null };
}

export async function setSelectedGoogleCalendar(calendarId: string): Promise<void> {
  const db = getServiceClient();
  const { error } = await db
    .from("platform_connections")
    .update({ account_label: calendarId, updated_at: new Date().toISOString() })
    .eq("platform", "google_calendar");
  if (error) throw error;
}

async function getAuthorizedClient() {
  const db = getServiceClient();
  const { data, error } = await db
    .from("platform_connections")
    .select("access_token, refresh_token")
    .eq("platform", "google_calendar")
    .maybeSingle();

  if (error) throw error;
  if (!data?.refresh_token) {
    throw new Error("Google Calendar isn't connected. Connect it from the Content Calendar page first.");
  }

  const client = getOAuthClient();
  client.setCredentials({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });

  client.on("tokens", async (tokens) => {
    if (!tokens.access_token) return;
    await db
      .from("platform_connections")
      .update({
        access_token: tokens.access_token,
        expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("platform", "google_calendar");
  });

  return client;
}

export interface GoogleCalendarListEntry {
  id: string;
  summary: string;
  primary: boolean;
}

export async function listGoogleCalendars(): Promise<GoogleCalendarListEntry[]> {
  const auth = await getAuthorizedClient();
  const calendar = google.calendar({ version: "v3", auth });
  const response = await calendar.calendarList.list();
  return (response.data.items ?? []).map((item) => ({
    id: item.id ?? "",
    summary: item.summary ?? item.id ?? "Untitled calendar",
    primary: !!item.primary,
  }));
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  dateStr: string; // "YYYY-MM-DD", the event's local date
}

// Pulls events from the connected calendar for one month, excluding any
// whose id is in excludeEventIds — those are events WE pushed there from
// a synced note (see utils/calendarSync.ts equivalents in the API routes),
// so showing them again here would just duplicate that note's own chip.
export async function listGoogleCalendarEvents(
  year: number,
  month: number,
  excludeEventIds: Set<string>
): Promise<GoogleCalendarEvent[]> {
  const { selectedCalendarId } = await getGoogleCalendarConnection();
  if (!selectedCalendarId) return [];

  const auth = await getAuthorizedClient();
  const calendar = google.calendar({ version: "v3", auth });

  const timeMin = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const timeMax = new Date(Date.UTC(year, month, 1)).toISOString();

  const response = await calendar.events.list({
    calendarId: selectedCalendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });

  const events: GoogleCalendarEvent[] = [];
  for (const item of response.data.items ?? []) {
    if (!item.id || excludeEventIds.has(item.id)) continue;
    const dateStr = (item.start?.date || item.start?.dateTime || "").slice(0, 10);
    if (!dateStr) continue;
    events.push({ id: item.id, summary: item.summary || "Untitled event", dateStr });
  }
  return events;
}

export async function createGoogleCalendarEvent(dateStr: string, summary: string, description?: string): Promise<string> {
  const { selectedCalendarId } = await getGoogleCalendarConnection();
  if (!selectedCalendarId) throw new Error("No Google calendar selected yet.");

  const auth = await getAuthorizedClient();
  const calendar = google.calendar({ version: "v3", auth });

  const response = await calendar.events.insert({
    calendarId: selectedCalendarId,
    requestBody: {
      summary,
      description: description || undefined,
      start: { date: dateStr },
      end: { date: dateStr },
    },
  });

  if (!response.data.id) throw new Error("Google Calendar didn't return an event ID.");
  return response.data.id;
}

export async function updateGoogleCalendarEvent(
  googleEventId: string,
  dateStr: string,
  summary: string,
  description?: string
): Promise<void> {
  const { selectedCalendarId } = await getGoogleCalendarConnection();
  if (!selectedCalendarId) throw new Error("No Google calendar selected yet.");

  const auth = await getAuthorizedClient();
  const calendar = google.calendar({ version: "v3", auth });

  await calendar.events.update({
    calendarId: selectedCalendarId,
    eventId: googleEventId,
    requestBody: {
      summary,
      description: description || undefined,
      start: { date: dateStr },
      end: { date: dateStr },
    },
  });
}

export async function deleteGoogleCalendarEvent(googleEventId: string): Promise<void> {
  const { selectedCalendarId } = await getGoogleCalendarConnection();
  if (!selectedCalendarId) return;

  const auth = await getAuthorizedClient();
  const calendar = google.calendar({ version: "v3", auth });

  try {
    await calendar.events.delete({ calendarId: selectedCalendarId, eventId: googleEventId });
  } catch (error) {
    // Already deleted on Google's side (e.g. removed directly in Google
    // Calendar) — not a real failure from our side, nothing left to do.
    const status = (error as { code?: number })?.code;
    if (status !== 404 && status !== 410) throw error;
  }
}
