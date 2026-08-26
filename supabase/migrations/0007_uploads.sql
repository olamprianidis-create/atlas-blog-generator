-- Stat.ATLAS: video Uploads page (cross-posting to YouTube + TikTok).
--
-- platform_connections holds the OAuth tokens for each connected platform
-- account (one row per platform — this tool posts as a single ATLAS
-- account per platform, not multi-account). access_token/refresh_token are
-- stored as-is (service-role client only, never exposed to the browser).
create table if not exists platform_connections (
  platform text primary key check (platform in ('youtube', 'tiktok')),
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  account_label text,
  scope text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- video_uploads tracks one row per video the admin submits on the Uploads
-- page, with independent status/error tracking per target platform so a
-- YouTube failure doesn't block or hide a successful TikTok publish (and
-- vice versa).
create table if not exists video_uploads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  tags text[] not null default '{}',
  video_url text not null,
  thumbnail_url text,

  target_youtube boolean not null default false,
  youtube_status text not null default 'not_selected'
    check (youtube_status in ('not_selected', 'pending', 'publishing', 'published', 'failed', 'not_connected')),
  youtube_video_id text,
  youtube_error text,
  youtube_privacy_status text default 'public'
    check (youtube_privacy_status in ('public', 'unlisted', 'private')),
  youtube_category_id text,
  youtube_made_for_kids boolean not null default false,

  target_tiktok boolean not null default false,
  tiktok_status text not null default 'not_selected'
    check (tiktok_status in ('not_selected', 'pending', 'publishing', 'published', 'failed', 'not_connected')),
  tiktok_publish_id text,
  tiktok_error text,
  tiktok_privacy_level text default 'PUBLIC_TO_EVERYONE',
  tiktok_disable_comment boolean not null default false,
  tiktok_disable_duet boolean not null default false,
  tiktok_disable_stitch boolean not null default false,
  tiktok_cover_timestamp_ms integer default 1000,

  publish_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists video_uploads_publish_at_idx on video_uploads (publish_at);
create index if not exists video_uploads_created_at_idx on video_uploads (created_at desc);
