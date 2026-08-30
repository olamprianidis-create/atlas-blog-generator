import { getServiceClient } from "./supabase";

// Setup required before this works:
// 1. Create an app at https://discord.com/developers/applications, add a
//    Bot to it, and copy its token.
// 2. Under the bot's settings, enable it, and under OAuth2 > URL
//    Generator pick scope "bot" + permission "Send Messages", then open
//    the generated URL to invite the bot into your Discord server.
// 3. Set DISCORD_BOT_TOKEN in .env.local and Vercel.
// This uses a bot token, not per-user OAuth — there's nothing to
// "connect" from the UI beyond having the env var set and the bot
// actually sitting in your server, since the bot posts as itself, not as
// a specific member's account.
const API_BASE = "https://discord.com/api/v10";

export function isDiscordConfigured(): boolean {
  return !!process.env.DISCORD_BOT_TOKEN;
}

function requireToken(): string {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("Discord isn't configured yet (missing DISCORD_BOT_TOKEN).");
  return token;
}

export async function postToDiscord(channelId: string, content: string): Promise<string> {
  const token = requireToken();

  const response = await fetch(`${API_BASE}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord post failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  return data.id as string;
}

export interface DiscordChannel {
  id: string;
  label: string;
  channel_id: string;
  is_default: boolean;
}

export async function listDiscordChannels(): Promise<DiscordChannel[]> {
  const db = getServiceClient();
  const { data, error } = await db.from("discord_channels").select("*").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addDiscordChannel(label: string, channelId: string, isDefault: boolean): Promise<DiscordChannel> {
  const db = getServiceClient();
  if (isDefault) {
    await db.from("discord_channels").update({ is_default: false }).eq("is_default", true);
  }
  const { data, error } = await db
    .from("discord_channels")
    .insert({ label, channel_id: channelId, is_default: isDefault })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function setDefaultDiscordChannel(id: string): Promise<void> {
  const db = getServiceClient();
  await db.from("discord_channels").update({ is_default: false }).eq("is_default", true);
  const { error } = await db.from("discord_channels").update({ is_default: true }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteDiscordChannel(id: string): Promise<void> {
  const db = getServiceClient();
  const { error } = await db.from("discord_channels").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Used by the auto-post-on-publish hooks (utils/publish.ts,
// utils/publishVideo.ts) — silently does nothing if Discord isn't
// configured or no channel has been marked default, since auto-posting
// is opt-in, not a hard requirement for publishing to succeed.
export async function autoPostToDiscord(content: string): Promise<void> {
  if (!isDiscordConfigured()) return;
  const db = getServiceClient();
  const { data } = await db.from("discord_channels").select("channel_id").eq("is_default", true).maybeSingle();
  if (!data?.channel_id) return;
  await postToDiscord(data.channel_id, content);
}
