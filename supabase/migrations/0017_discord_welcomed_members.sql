-- Backs the "welcome new Discord members" cron (see
-- pages/api/cron/welcome-new-members.ts) — every real (non-bot) guild
-- member id that's already had a welcome message posted for them, so a
-- member is only ever welcomed once even though the cron re-polls the
-- full member list every ~10 minutes.
create table if not exists discord_welcomed_members (
  discord_user_id text primary key,
  welcomed_at timestamptz not null default now()
);
