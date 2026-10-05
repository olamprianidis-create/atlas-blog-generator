-- Backs the Contacts page (pages/contacts.tsx) — the address book the
-- planned Email outreach feature will send to. Deliberately separate from
-- the ATLAS Website's own User table (different Postgres instance, and
-- contacts here can be anyone: partners, prospects, speakers, not just
-- signed-up members).

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null default '',
  last_name text not null default '',
  email text,
  phone text,
  company text,
  notes text,
  -- Email outreach will honor this (never send to an unsubscribed contact);
  -- defaulted now so the column already exists when that ships.
  subscribed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One contact per email address (case-insensitive); contacts without an
-- email (phone-only) are unaffected since NULLs never collide.
create unique index if not exists contacts_email_unique_idx
  on contacts (lower(email));
