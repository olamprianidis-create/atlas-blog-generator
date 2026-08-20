-- ATLAS Blog Generator: store the AI keyword research results alongside
-- each article's history record, for future reference (Phase 3 enhancement:
-- dynamic AI-powered keyword research replacing the static spreadsheet).

alter table article_history
  add column if not exists keyword_research jsonb;
