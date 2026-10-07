-- Lets a campaign's audience include hand-picked contacts (the "Specific
-- people" search on the wizard's Audience step), on top of whole lists.
-- Ids of deleted contacts are simply ignored when the audience resolves.
alter table email_campaigns
  add column if not exists audience_contact_ids uuid[] not null default '{}';
