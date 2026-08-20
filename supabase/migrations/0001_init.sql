-- ATLAS Blog Generator: initial schema
-- Run this in the Supabase SQL editor, or via `npx supabase db push`
-- once the project is linked (`npx supabase link`).

create extension if not exists "pgcrypto";

do $$ begin
  create type article_category as enum (
    'entrepreneurship',
    'health',
    'mental_health',
    'community',
    'friends',
    'sports'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type article_status as enum ('draft', 'scheduled', 'published');
exception
  when duplicate_object then null;
end $$;

create table if not exists scheduled_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content_markdown text not null,
  content_html text,
  keywords jsonb not null default '[]'::jsonb,
  meta_description text,
  category article_category not null,
  internal_links jsonb not null default '[]'::jsonb,
  external_links jsonb not null default '[]'::jsonb,
  publish_date timestamptz,
  status article_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists article_history (
  id uuid primary key default gen_random_uuid(),
  user_prompt text not null,
  outline_generated jsonb,
  keywords_used jsonb,
  article_id uuid references scheduled_articles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_scheduled_articles_status on scheduled_articles(status);
create index if not exists idx_scheduled_articles_publish_date on scheduled_articles(publish_date);
create index if not exists idx_article_history_article_id on article_history(article_id);

-- keep updated_at current on scheduled_articles
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_scheduled_articles_updated_at on scheduled_articles;
create trigger trg_scheduled_articles_updated_at
  before update on scheduled_articles
  for each row execute function set_updated_at();
