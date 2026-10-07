-- Remembers which ATLAS Website members have already been copied into
-- Contacts + the "ATLAS Network" list (utils/memberSync.ts), so each new
-- member is added exactly once — removing someone from the list by hand
-- sticks instead of being undone on the next sync.
create table if not exists member_contact_syncs (
  website_user_id text primary key, -- ATLAS Website "User".id
  contact_id uuid references contacts(id) on delete set null,
  synced_at timestamptz not null default now()
);
alter table member_contact_syncs enable row level security;

-- The 9 members as of 2026-10-07, copied in by hand that day and already
-- on the list.
insert into member_contact_syncs (website_user_id) values
  ('cmt0wvf7r000004l5lbhuualr'), ('cmtafnz09000004l7cu2x7z01'), ('cmt7vi5yq000004gy1uuc9nnt'),
  ('cmt7mvmdt000004l7x8dafxsz'), ('cmsqmi07y000004ldp4y8yr6y'), ('cms2fukhv0000caitvqh8ac0w'),
  ('cmt0t4a1b000004jrj6glbe5t'), ('cmti2s45b000004jr3d3v5kex'), ('cmtax6fxo000004jxfyr79doy')
on conflict do nothing;
