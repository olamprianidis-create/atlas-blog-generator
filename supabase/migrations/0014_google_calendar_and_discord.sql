-- Stat.ATLAS: Google Calendar (two-way sync) + Discord (bot posting).
--
-- Google Calendar reuses platform_connections (0007_uploads.sql) for its
-- OAuth token, so the platform check needs to allow 'google_calendar' too.
-- account_label on that row stores which Google calendar was picked
-- (its calendarId), since one Google account can have many calendars.
alter table platform_connections drop constraint if exists platform_connections_platform_check;
alter table platform_connections add constraint platform_connections_platform_check
  check (platform in ('youtube', 'tiktok', 'linkedin', 'google_calendar'));

-- Per-note opt-in: only notes with sync_to_google_calendar = true get
-- pushed to the connected Google calendar. google_event_id links the note
-- to its mirrored Google event so edits/deletes stay in sync instead of
-- creating duplicates.
alter table content_calendar_events add column if not exists sync_to_google_calendar boolean not null default false;
alter table content_calendar_events add column if not exists google_event_id text;

-- Discord posts via a bot token (DISCORD_BOT_TOKEN env var, not stored
-- here) rather than per-account OAuth, so there's no platform_connections
-- row for it. discord_channels is just a saved address book of channel
-- IDs the admin can pick from instead of pasting a raw ID every time, with
-- one of them optionally marked default for auto-post-on-publish.
create table if not exists discord_channels (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  channel_id text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists discord_channels_channel_id_idx on discord_channels (channel_id);
