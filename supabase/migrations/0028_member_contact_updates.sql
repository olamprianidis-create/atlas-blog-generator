-- 2026-10-16: keep Contacts up to date when a member edits their email or
-- phone on the ATLAS Website Profile Editor (utils/memberSync.ts
-- syncMemberContactChanges). The member's email/phone as of the last sync
-- are remembered here, so only a real change on the Website is pushed to
-- the contact — edits made to that contact inside Stat.ATLAS are left alone.
alter table member_contact_syncs add column if not exists synced_email text;
alter table member_contact_syncs add column if not exists synced_phone text;
