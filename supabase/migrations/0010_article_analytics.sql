-- Article-level analytics for the Published page's per-article Statistics
-- view. Three insert-only tables, written to by the ATLAS Website (using
-- its existing SUPABASE_ANON_KEY — no new credentials needed there) and
-- read by Stat.ATLAS's service role, which bypasses RLS.
--
-- Split into three tables instead of one so every write is a plain INSERT
-- with no UPDATE needed anywhere (an anon key with insert-only RLS can
-- never modify or read back a row it — or anyone else — already wrote):
--   - article_impressions: an article card was shown on the /articles
--     listing page (feeds the click-through-rate denominator).
--   - article_page_views: someone actually opened /article/[slug]
--     (feeds total views, unique viewers, referrer/device breakdowns,
--     and — via referrer_category = 'internal_listing' — the CTR
--     numerator).
--   - article_view_durations: a second insert fired via sendBeacon when
--     a view ends, carrying how long the page was open. Kept separate
--     from article_page_views (rather than an UPDATE onto it) for the
--     same insert-only-RLS reason above.

create table if not exists article_impressions (
  id bigint generated always as identity primary key,
  article_id uuid not null references scheduled_articles(id) on delete cascade,
  visitor_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists article_impressions_article_id_idx on article_impressions(article_id);

create table if not exists article_page_views (
  id bigint generated always as identity primary key,
  article_id uuid not null references scheduled_articles(id) on delete cascade,
  visitor_id text not null,
  session_id text not null,
  referrer_category text not null default 'other'
    check (referrer_category in ('direct', 'internal_listing', 'internal_other', 'social', 'search', 'other')),
  device_type text not null default 'unknown'
    check (device_type in ('mobile', 'tablet', 'desktop', 'unknown')),
  created_at timestamptz not null default now()
);

create index if not exists article_page_views_article_id_idx on article_page_views(article_id);
create index if not exists article_page_views_created_at_idx on article_page_views(created_at);

create table if not exists article_view_durations (
  id bigint generated always as identity primary key,
  article_id uuid not null references scheduled_articles(id) on delete cascade,
  session_id text not null,
  duration_seconds integer not null check (duration_seconds >= 0),
  created_at timestamptz not null default now()
);

create index if not exists article_view_durations_article_id_idx on article_view_durations(article_id);

alter table article_impressions enable row level security;
alter table article_page_views enable row level security;
alter table article_view_durations enable row level security;

-- anon (the Website's existing SUPABASE_ANON_KEY) may insert tracking
-- events but never read, update, or delete them — only the service role
-- (used server-side in Stat.ATLAS) can read this data back.
create policy "anon can insert impressions" on article_impressions
  for insert to anon with check (true);
create policy "anon can insert page views" on article_page_views
  for insert to anon with check (true);
create policy "anon can insert view durations" on article_view_durations
  for insert to anon with check (true);
