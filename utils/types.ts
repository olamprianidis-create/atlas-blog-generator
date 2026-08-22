export type Category =
  | "entrepreneurship"
  | "health"
  | "mental_health"
  | "community"
  | "friends"
  | "sports";

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "entrepreneurship", label: "Entrepreneurship" },
  { value: "health", label: "Health" },
  { value: "mental_health", label: "Mental Health" },
  { value: "community", label: "Community" },
  { value: "friends", label: "Friends" },
  { value: "sports", label: "Sports" },
];

export const STEPS = [
  { number: 1, label: "Topic & Prompt" },
  { number: 2, label: "Image & Keywords" },
  { number: 3, label: "Outline Approval" },
  { number: 4, label: "Full Article" },
  { number: 5, label: "Schedule & Store" },
] as const;

export type StepNumber = 1 | 2 | 3 | 4 | 5;

export type Platform = "instagram" | "youtube" | "tiktok" | "pinterest" | "facebook";

export const PLATFORMS: { value: Platform; label: string; colorClass: string }[] = [
  { value: "instagram", label: "Instagram", colorClass: "bg-pink-500" },
  { value: "youtube", label: "YouTube", colorClass: "bg-red-600" },
  { value: "tiktok", label: "TikTok", colorClass: "bg-slate-900" },
  { value: "pinterest", label: "Pinterest", colorClass: "bg-rose-600" },
  { value: "facebook", label: "Facebook", colorClass: "bg-blue-600" },
];
