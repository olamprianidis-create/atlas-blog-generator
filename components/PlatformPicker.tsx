import { Platform, PLATFORMS } from "../utils/types";

interface PlatformPickerProps {
  selected: Platform[];
  onChange: (platforms: Platform[]) => void;
}

export default function PlatformPicker({ selected, onChange }: PlatformPickerProps) {
  function toggle(value: Platform) {
    if (selected.includes(value)) {
      onChange(selected.filter((p) => p !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {PLATFORMS.map((platform) => {
        const isSelected = selected.includes(platform.value);
        return (
          <button
            key={platform.value}
            type="button"
            onClick={() => toggle(platform.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              isSelected
                ? `${platform.colorClass} text-white`
                : "border border-slate-200 bg-white text-slate-500 hover:border-slate-300"
            }`}
          >
            {platform.label}
          </button>
        );
      })}
    </div>
  );
}
