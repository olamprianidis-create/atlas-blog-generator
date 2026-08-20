-- ATLAS Blog Generator: optional publish-attempt log (Phase 7)
-- Run this in the Supabase SQL editor if you want persisted publish
-- logs. Without it, publish attempts still log to the console —
-- utils/webhookLogger.ts degrades gracefully if this table is missing.

create table if not exists article_publish_log (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references scheduled_articles(id) on delete set null,
  status text not null check (status in ('success', 'error')),
  message text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_article_publish_log_article_id on article_publish_log(article_id);
create index if not exists idx_article_publish_log_attempted_at on article_publish_log(attempted_at);
