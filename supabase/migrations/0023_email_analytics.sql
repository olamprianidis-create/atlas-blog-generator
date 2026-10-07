-- Email campaign analytics (phase 4). Resend posts every delivery /
-- engagement event to pages/api/email/webhook.ts, which stores it here and
-- stamps the matching email_sends row. Reports are computed from these
-- (utils/emailAnalytics.ts).
create table if not exists email_events (
  id uuid primary key default gen_random_uuid(),
  svix_id text unique,          -- webhook delivery id; makes Resend retries idempotent
  send_id uuid references email_sends(id) on delete cascade,
  campaign_id uuid references email_campaigns(id) on delete cascade,
  type text not null,           -- e.g. 'email.opened' (Resend's event name)
  link text,                    -- email.clicked only
  occurred_at timestamptz not null,
  data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists email_events_campaign_type_idx on email_events (campaign_id, type);
create index if not exists email_events_send_idx on email_events (send_id);
alter table email_events enable row level security;

alter table email_sends
  add column if not exists complained_at timestamptz,
  add column if not exists unsubscribed_at timestamptz,
  add column if not exists bounce_type text;

-- Why an address is on the do-not-send list: they unsubscribed, hard
-- bounced, or marked us as spam. All three are skipped by every send.
alter table email_unsubscribes
  add column if not exists reason text not null default 'unsubscribed'
    check (reason in ('unsubscribed', 'bounced', 'complained'));
