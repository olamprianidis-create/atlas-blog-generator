-- Adds "Finance" as a new article Topic/category alongside the existing
-- entrepreneurship/health/mental_health/community/friends/sports set
-- (see utils/types.ts's CATEGORIES and the Website's ArticleCategory type).
alter type article_category add value if not exists 'finance';
