import { Category } from "./types";

export const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  entrepreneurship: ["business growth", "startup", "revenue scaling"],
  health: ["fitness", "nutrition", "wellness"],
  mental_health: ["stress management", "mindset", "anxiety"],
  community: ["networking", "relationships", "belonging"],
  friends: ["friendship", "connection", "loyalty"],
  sports: ["athletic performance", "training", "competition"],
};

export function getBaseKeywords(category: Category | null): string[] {
  return category ? CATEGORY_KEYWORDS[category] : [];
}

// Drops any suggested keyword that's just a base keyword restated.
export function dedupeSuggested(base: string[], suggested: string[]): string[] {
  const baseSet = new Set(base.map((k) => k.trim().toLowerCase()));
  return suggested
    .map((k) => k.trim())
    .filter((k) => k.length > 0 && !baseSet.has(k.toLowerCase()));
}
