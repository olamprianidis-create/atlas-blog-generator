import { Category } from "../../utils/types";
import TopicSelector from "./TopicSelector";
import Spinner from "../Spinner";

interface StepOneOutlineProps {
  selectedCategory: Category | null;
  onSelectCategory: (category: Category) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  isLoading: boolean;
  error: string | null;
  onGenerate: () => void;
}

export default function StepOneOutline({
  selectedCategory,
  onSelectCategory,
  prompt,
  onPromptChange,
  isLoading,
  error,
  onGenerate,
}: StepOneOutlineProps) {
  const canGenerate = !isLoading && (prompt.trim().length > 0 || selectedCategory !== null);

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-xl font-semibold text-slate-900">
        Step 1: Generate Outline + Keywords
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Pick a topic and/or describe what the article should cover.
      </p>

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-slate-700">Topic</p>
        <TopicSelector selected={selectedCategory} onSelect={onSelectCategory} />
      </div>

      <div className="mt-6">
        <label htmlFor="prompt" className="mb-2 block text-sm font-medium text-slate-700">
          Your prompt
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="Ask a question, share a statistic, or pick a topic..."
          rows={6}
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isLoading && <Spinner />}
          {isLoading ? "Generating..." : "Generate Outline & Keywords"}
        </button>
      </div>
    </div>
  );
}
