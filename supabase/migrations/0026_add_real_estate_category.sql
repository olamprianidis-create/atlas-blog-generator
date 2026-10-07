-- Adds "Real Estate" as an article Topic/category (requested 2026-10-07).
-- Mirrored in utils/types.ts's CATEGORIES and the Website's ArticleCategory
-- type (whose categoryLabel() turns real_estate into "Real Estate").
alter type article_category add value if not exists 'real_estate';
