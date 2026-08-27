-- Stat.ATLAS: optional Author field on Step 1, stored as the ATLAS
-- Website's User.id (a plain text foreign key across databases — no real
-- FK constraint possible since that table lives in a separate Postgres
-- instance). The Website's own /article/[slug] page resolves this id
-- against its own User/Profile tables at render time (same DB there, so
-- always-current name/photo/join-date, no denormalized copy needed here).

alter table scheduled_articles add column if not exists author_user_id text;
