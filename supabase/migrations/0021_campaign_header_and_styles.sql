-- Campaign email design (wizard Step 4): an optional rich-text header above
-- the body, plus per-section style settings (font, size, background color,
-- alignment) for both. '{}' means "use the defaults" — see
-- withSectionDefaults() in utils/emailCampaigns.ts.
alter table email_campaigns
  add column if not exists header_html text not null default '',
  add column if not exists header_style jsonb not null default '{}',
  add column if not exists body_style jsonb not null default '{}';
