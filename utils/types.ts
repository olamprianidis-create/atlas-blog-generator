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
