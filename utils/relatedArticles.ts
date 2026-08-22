export interface RelatedArticleItem {
  id: string;
  title: string;
  url: string;
  category: string;
  publishDate: string | null;
}

export interface RelatedArticlesResponse {
  recommended: RelatedArticleItem[];
  recent: RelatedArticleItem[];
}
