-- ATLAS Blog Generator: content calendar page (checkable days + planned
-- social posts, separate from the blog-article scheduling pipeline).

create table if not exists content_calendar_days (
  day date primary key,
  created_at timestamptz not null default now()
);

create table if not exists content_calendar_events (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  platforms text[] not null default '{}',
  description text,
  thumbnail_url text,
  created_at timestamptz not null default now()
);

create index if not exists content_calendar_events_date_idx
  on content_calendar_events (event_date);
