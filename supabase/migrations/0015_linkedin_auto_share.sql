-- Stat.ATLAS: per-article opt-out from LinkedIn auto-sharing.
--
-- Previously every article shared to LinkedIn automatically on publish
-- with no way to exclude one — this adds a per-article toggle, defaulted
-- to true so every article scheduled before this migration (which all
-- assumed auto-share was on) keeps behaving exactly the same.
alter table scheduled_articles add column if not exists linkedin_auto_share boolean not null default true;
