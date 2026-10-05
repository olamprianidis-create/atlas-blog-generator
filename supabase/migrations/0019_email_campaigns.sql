-- Email outreach: contact lists, campaigns, per-recipient send records,
-- and a global unsubscribe registry. See CLAUDE.md "Email campaigns".
-- Every table has RLS on with no policies — only the service-role client
-- (server-side API routes) can touch them, never the public anon key.

-- Contact lists ("folders") a campaign can target.
create table if not exists contact_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists contact_lists_name_unique_idx on contact_lists (lower(name));

create table if not exists contact_list_members (
  list_id uuid not null references contact_lists(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, contact_id)
);
create index if not exists contact_list_members_contact_idx on contact_list_members (contact_id);

-- One row per unsubscribed address (lowercased). Covers both Contacts and
-- ATLAS members pulled live from the Website DB, so it's the single
-- source of truth checked on every send.
create table if not exists email_unsubscribes (
  email text primary key,
  unsubscribed_at timestamptz not null default now(),
  campaign_id uuid
);

create table if not exists email_campaigns (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'canceled', 'failed')),
  current_step integer not null default 1,

  -- Step 1: audience
  audience_list_ids uuid[] not null default '{}',
  include_all_members boolean not null default false,
  include_all_contacts boolean not null default false,

  -- Step 2: when (send_at is the resolved instant; date/time/timezone are
  -- kept so the form re-opens exactly as typed)
  send_immediately boolean not null default false,
  send_date text,
  send_time text,
  timezone text not null default 'PST',
  send_at timestamptz,

  -- Step 3: subject & sender
  from_name text not null default 'ATLAS Network',
  subject text not null default '',
  preview_text text not null default '',

  -- Step 4: content
  body_html text not null default '',

  source_article_id uuid references scheduled_articles(id) on delete set null,
  recipient_count integer,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists email_campaigns_status_send_at_idx on email_campaigns (status, send_at);

-- One row per recipient per campaign. The unique constraint is what
-- guarantees nobody gets the same campaign twice, even if a send is
-- interrupted and resumed.
create table if not exists email_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references email_campaigns(id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  contact_id uuid references contacts(id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'delivered', 'opened', 'clicked', 'bounced', 'complained')),
  resend_id text,
  error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, email)
);
create index if not exists email_sends_campaign_status_idx on email_sends (campaign_id, status);
create index if not exists email_sends_resend_id_idx on email_sends (resend_id);

alter table contacts enable row level security;
alter table contact_lists enable row level security;
alter table contact_list_members enable row level security;
alter table email_unsubscribes enable row level security;
alter table email_campaigns enable row level security;
alter table email_sends enable row level security;
