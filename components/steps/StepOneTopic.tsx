import { Category } from "../../utils/types";
import TopicSelector from "./TopicSelector";
import AuthorPicker from "./AuthorPicker";
import DocumentUpload, { UploadedDocument } from "./DocumentUpload";

interface StepOneTopicProps {
  selectedCategory: Category | null;
  onSelectCategory: (category: Category) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  preliminaryKeywords: string;
  onPreliminaryKeywordsChange: (value: string) => void;
  authorUserId: string | null;
  onAuthorChange: (memberId: string | null) => void;
  referenceDocuments: UploadedDocument[];
  onReferenceDocumentsChange: (documents: UploadedDocument[]) => void;
  onNext: () => void;
}

export default function StepOneTopic({
  selectedCategory,
  onSelectCategory,
  prompt,
  onPromptChange,
  preliminaryKeywords,
  onPreliminaryKeywordsChange,
  authorUserId,
  onAuthorChange,
  referenceDocuments,
  onReferenceDocumentsChange,
  onNext,
}: StepOneTopicProps) {
  const canContinue = prompt.trim().length > 0 || selectedCategory !== null;

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-xl font-semibold text-slate-900">Step 1: Topic & Prompt</h2>
      <p className="mt-1 text-sm text-slate-500">
        Pick a topic and/or describe what the article should cover.
      </p>

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-slate-700">Topic</p>
        <TopicSelector selected={selectedCategory} onSelect={onSelectCategory} />
      </div>

      <div className="mt-6">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Reference Documents <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <p className="mb-2 text-xs text-slate-500">
          Upload any reports, data, or notes you want this article to draw from — Claude reads
          and interprets them as additional research, alongside the live web search findings.
        </p>
        <DocumentUpload documents={referenceDocuments} onChange={onReferenceDocumentsChange} />
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

      <div className="mt-6">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Author <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <AuthorPicker value={authorUserId} onChange={onAuthorChange} />
      </div>

      <div className="mt-6">
        <label htmlFor="preliminary-keywords" className="mb-2 block text-sm font-medium text-slate-700">
          Preliminary Keywords <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <p className="mb-2 text-xs text-slate-500">
          The main keywords you want this article to primarily rank for. On the next step,
          keyword research will build medium- and long-tail variations around these.
        </p>
        <textarea
          id="preliminary-keywords"
          value={preliminaryKeywords}
          onChange={(event) => onPreliminaryKeywordsChange(event.target.value)}
          placeholder="e.g. startup term sheet negotiation, first funding round"
          rows={2}
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Next: Image & Keywords
        </button>
      </div>
    </div>
  );
}
