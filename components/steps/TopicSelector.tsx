import { CATEGORIES, Category } from "../../utils/types";

interface TopicSelectorProps {
  // In the order picked — the first is the article's main topic.
  selected: Category[];
  onToggle: (category: Category) => void;
}

// Several topics can be picked; the article shows on each one's topic page
// on the ATLAS Website. The first pick is the main topic (used for related
// articles and the topic label on article cards).
export default function TopicSelector({ selected, onToggle }: TopicSelectorProps) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CATEGORIES.map((category) => {
          const index = selected.indexOf(category.value);
          const isSelected = index !== -1;

          return (
            <button
              key={category.value}
              type="button"
              onClick={() => onToggle(category.value)}
              aria-pressed={isSelected}
              className={`relative rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                isSelected
                  ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              {category.label}
              {index === 0 && selected.length > 1 && (
                <span className="ml-2 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  Main
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Pick one or more. The first one you pick is the main topic.
      </p>
    </div>
  );
}
