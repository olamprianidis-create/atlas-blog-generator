import { CATEGORIES, Category } from "../../utils/types";

interface TopicSelectorProps {
  selected: Category | null;
  onSelect: (category: Category) => void;
}

export default function TopicSelector({ selected, onSelect }: TopicSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {CATEGORIES.map((category) => {
        const isSelected = selected === category.value;

        return (
          <button
            key={category.value}
            type="button"
            onClick={() => onSelect(category.value)}
            aria-pressed={isSelected}
            className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
              isSelected
                ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50"
            }`}
          >
            {category.label}
          </button>
        );
      })}
    </div>
  );
}
