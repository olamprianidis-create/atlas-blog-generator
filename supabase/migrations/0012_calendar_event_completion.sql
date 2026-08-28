-- Stat.ATLAS: per-item completion checkboxes on the Content Calendar,
-- replacing the old single whole-day checkbox (content_calendar_days).
--
-- One event can target multiple platforms (Instagram + LinkedIn, say),
-- each rendered as its own chip on the calendar — completed_platforms
-- tracks which of those specific platforms have actually been posted,
-- independently of each other. A platform-less event (no platforms
-- selected) uses the literal string 'general' as its one entry.
alter table content_calendar_events
  add column if not exists completed_platforms text[] not null default '{}';
