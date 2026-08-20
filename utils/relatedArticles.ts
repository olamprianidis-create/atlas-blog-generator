export interface RelatedArticle {
  title: string;
  url: string;
  category: string;
}

// Placeholder stand-in for a real "latest 3 published articles" query
// against the scheduled_articles Supabase table, filtered by category,
// used to suggest internal links while writing the full article.
export const PLACEHOLDER_RELATED_ARTICLES: RelatedArticle[] = [
  {
    title: "5 Habits Every First-Time Founder Should Build Early",
    url: "https://atlasnetwork.club/blog/first-time-founder-habits",
    category: "Entrepreneurship",
  },
  {
    title: "Why Community Support Predicts Long-Term Success",
    url: "https://atlasnetwork.club/blog/community-support-success",
    category: "Community",
  },
  {
    title: "The Science of Recovery: Training Smarter, Not Harder",
    url: "https://atlasnetwork.club/blog/training-recovery-science",
    category: "Sports",
  },
];
