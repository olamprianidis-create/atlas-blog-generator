-- New campaigns (including "Create Email Blast" drafts) start with the
-- sender name "Odysseas" (requested 2026-10-07); editable per campaign.
alter table email_campaigns alter column from_name set default 'Odysseas';
