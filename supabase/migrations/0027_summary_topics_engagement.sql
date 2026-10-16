-- 2026-10-16: one-sentence summaries, multiple topics per article, and
-- reader-engagement tracking for the per-article Statistics page.

-- Several topics per article. `category` stays as the primary topic (the
-- first one picked) so everything that reads a single category keeps
-- working; `categories` is the full list (primary first).
alter table scheduled_articles add column if not exists categories article_category[];
update scheduled_articles set categories = array[category] where categories is null;

-- The one-sentence "Summary:" line shown under the article title on the
-- ATLAS Website. Null = no summary line.
alter table scheduled_articles add column if not exists summary text;

-- How far down the article body a reader got, sent by the Website when
-- the tab is hidden/closed. A reader can produce several rows (one per
-- time they leave the tab having read further) — readers are counted by
-- session_id taking the max. `sections` is [{t: heading, p: percent}] —
-- where each section heading sat for this reader (layout differs by
-- device), and `newsletter_percent` where the in-article newsletter sat.
create table if not exists article_scroll_depths (
  id bigint generated always as identity primary key,
  article_id uuid not null references scheduled_articles(id) on delete cascade,
  session_id text not null,
  max_percent smallint not null check (max_percent between 0 and 100),
  sections jsonb not null default '[]'::jsonb,
  newsletter_percent smallint check (newsletter_percent between 0 and 100),
  device_type text not null default 'unknown'
    check (device_type in ('mobile', 'tablet', 'desktop', 'unknown')),
  created_at timestamptz not null default now()
);

create index if not exists article_scroll_depths_article_id_idx on article_scroll_depths(article_id);

-- "Seen vs. Clicked": one row per (session, element, action). `seen` =
-- the element was scrolled into view; `click` = a link/button in it was
-- clicked (for newsletter boxes, a completed sign-up).
create table if not exists article_element_events (
  id bigint generated always as identity primary key,
  article_id uuid not null references scheduled_articles(id) on delete cascade,
  session_id text not null,
  element text not null check (element ~ '^[a-z_]{1,40}$'),
  action text not null check (action in ('seen', 'click')),
  created_at timestamptz not null default now()
);

create index if not exists article_element_events_article_id_idx on article_element_events(article_id);

alter table article_scroll_depths enable row level security;
alter table article_element_events enable row level security;

-- Same insert-only access as the 0010 analytics tables.
create policy "anon can insert scroll depths" on article_scroll_depths
  for insert to anon with check (true);
create policy "anon can insert element events" on article_element_events
  for insert to anon with check (true);
