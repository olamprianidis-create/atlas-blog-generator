-- Stat.ATLAS: LinkedIn integration — posts a link-share ("this article is
-- live") to the connected LinkedIn profile's feed whenever a blog article
-- is published. Reuses platform_connections (0007_uploads.sql) for the
-- OAuth token, so its platform check needs to allow 'linkedin' too.

alter table platform_connections drop constraint if exists platform_connections_platform_check;
alter table platform_connections add constraint platform_connections_platform_check
  check (platform in ('youtube', 'tiktok', 'linkedin'));

alter table scheduled_articles add column if not exists linkedin_status text not null default 'not_posted'
  check (linkedin_status in ('not_posted', 'posting', 'posted', 'failed', 'not_connected'));
alter table scheduled_articles add column if not exists linkedin_post_urn text;
alter table scheduled_articles add column if not exists linkedin_error text;
alter table scheduled_articles add column if not exists linkedin_posted_at timestamptz;
