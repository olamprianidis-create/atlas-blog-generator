-- ATLAS Blog Generator: lets users save wizard progress at any step and
-- resume later from the Drafts page, instead of losing work on refresh.

create table if not exists article_drafts (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled draft',
  category text,
  current_step integer not null default 1,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists article_drafts_updated_at_idx
  on article_drafts (updated_at desc);
