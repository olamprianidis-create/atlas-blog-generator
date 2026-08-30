-- Stat.ATLAS: separate short "header" for content_calendar_events
-- (post-it notes on the Content Calendar), distinct from the longer
-- free-text description. The header is the only thing shown on the
-- main month grid; the description is only shown once you open the day.
alter table content_calendar_events
  add column if not exists title text;
