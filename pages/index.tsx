import { useState } from "react";
import Header from "../components/layout/Header";
import Sidebar from "../components/layout/Sidebar";
import StepOneOutline from "../components/steps/StepOneOutline";
import StepOneResults, { KeywordItem } from "../components/steps/StepOneResults";
import StepTwoReview from "../components/steps/StepTwoReview";
import StepThreeArticle from "../components/steps/StepThreeArticle";
import StepFourSchedule, { ScheduleResult } from "../components/steps/StepFourSchedule";
import StepPlaceholder from "../components/steps/StepPlaceholder";
import { Category, StepNumber } from "../utils/types";
import type { ResearchQuery } from "../utils/webSearch";
import type { BlogOutline } from "../utils/outline";
import type { QualityCheckResult } from "../utils/qualityChecklist";
import { DEFAULT_TIMEZONE, buildPublishDate, formatPublishPreview } from "../utils/timezones";

interface GenerationState {
  research: ResearchQuery[];
  outline: BlogOutline;
  keywords: KeywordItem[];
  originalPrompt: string;
  extractedTopic: string;
}

interface GenerateOutlineApiResponse {
  research: ResearchQuery[];
  outline: BlogOutline;
  baseKeywords: string[];
  suggestedKeywords: string[];
  originalPrompt: string;
  extractedTopic: string;
}

interface GenerateArticleApiResponse {
  title: string;
  markdown: string;
  html: string;
  metaDescription: string;
  wordCount: number;
  readingTimeMinutes: number;
  checklist: QualityCheckResult[];
}

interface ArticleRecord {
  title: string;
  markdown: string;
  html: string;
  metaDescription: string;
  wordCount: number;
  readingTimeMinutes: number;
  checklist: QualityCheckResult[];
}

export default function Home() {
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generation, setGeneration] = useState<GenerationState | null>(null);
  const [isEditingKeywords, setIsEditingKeywords] = useState(false);
  const [keywordsDraft, setKeywordsDraft] = useState("");
  const [articleData, setArticleData] = useState<ArticleRecord | null>(null);
  const [isArticleLoading, setIsArticleLoading] = useState(false);
  const [articleError, setArticleError] = useState<string | null>(null);
  const [publishDate, setPublishDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [publishTime, setPublishTime] = useState("09:00");
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);

  function handleSelectCategory(category: Category) {
    setSelectedCategory((current) => (current === category ? null : category));
  }

  async function handleGenerate() {
    setIsLoading(true);
    setGenerateError(null);

    try {
      const response = await fetch("/api/generate-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: selectedCategory, prompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? `Request failed with status ${response.status}`);
      }

      const { research, outline, baseKeywords, suggestedKeywords, originalPrompt, extractedTopic } =
        data as GenerateOutlineApiResponse;

      const keywords: KeywordItem[] = [
        ...baseKeywords.map((text) => ({ text, isSuggested: false })),
        ...suggestedKeywords.map((text) => ({ text, isSuggested: true })),
      ];

      setGeneration({ research, outline, keywords, originalPrompt, extractedTopic });
      setKeywordsDraft(keywords.map((k) => k.text).join(", "));
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : "Generation failed for an unknown reason.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleToggleEditKeywords() {
    setIsEditingKeywords((current) => !current);
  }

  function handleSaveKeywords() {
    if (!generation) return;

    const edited = Array.from(
      new Set(
        keywordsDraft
          .split(",")
          .map((k) => k.trim())
          .filter((k) => k.length > 0)
      )
    );

    setGeneration({
      ...generation,
      keywords: edited.map((text) => ({ text, isSuggested: false })),
    });
    setIsEditingKeywords(false);
  }

  function handleApprove() {
    if (!generation) return;
    setCurrentStep(2);
  }

  function handleStartOver() {
    setGeneration(null);
    setGenerateError(null);
    setIsEditingKeywords(false);
  }

  function handleRestart() {
    setGeneration(null);
    setGenerateError(null);
    setIsEditingKeywords(false);
    setPrompt("");
    setSelectedCategory(null);
    setArticleData(null);
    setArticleError(null);
    setScheduleResult(null);
    setScheduleError(null);
    setPublishTime("09:00");
    setTimezone(DEFAULT_TIMEZONE);
    setIsPublishing(false);
    setPublishError(null);
    setIsPublished(false);
    setCurrentStep(1);
  }

  function handleReset() {
    setCurrentStep(1);
  }

  function handleAddKeywordStep2(text: string) {
    if (!generation) return;
    if (generation.keywords.some((k) => k.text.toLowerCase() === text.toLowerCase())) return;

    setGeneration({
      ...generation,
      keywords: [...generation.keywords, { text, isSuggested: false }],
    });
  }

  function handleRemoveKeywordStep2(text: string) {
    if (!generation) return;

    setGeneration({
      ...generation,
      keywords: generation.keywords.filter((k) => k.text !== text),
    });
  }

  function handleEditKeywordsFromStep2() {
    setCurrentStep(1);
  }

  async function fetchArticle(editInstructions?: string) {
    if (!generation) return;

    setIsArticleLoading(true);
    setArticleError(null);

    try {
      const response = await fetch("/api/generate-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCategory,
          topic: generation.extractedTopic || generation.originalPrompt,
          outline: generation.outline,
          keywords: generation.keywords.map((k) => k.text),
          research: generation.research,
          editInstructions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? `Request failed with status ${response.status}`);
      }

      const { title, markdown, html, metaDescription, wordCount, readingTimeMinutes, checklist } =
        data as GenerateArticleApiResponse;

      setArticleData({ title, markdown, html, metaDescription, wordCount, readingTimeMinutes, checklist });
    } catch (error) {
      setArticleError(error instanceof Error ? error.message : "Article generation failed for an unknown reason.");
    } finally {
      setIsArticleLoading(false);
    }
  }

  function handleApproveAndGenerate() {
    setCurrentStep(3);
    void fetchArticle();
  }

  function handleRequestEdits(instructions: string) {
    void fetchArticle(instructions);
  }

  function handleRetryArticle() {
    void fetchArticle();
  }

  function handleBackToStepTwo() {
    setCurrentStep(2);
  }

  function handleApproveAndSchedule() {
    setScheduleResult(null);
    setScheduleError(null);
    setIsPublished(false);
    setPublishError(null);
    setCurrentStep(4);
  }

  async function handleSchedule() {
    if (!generation || !articleData || !selectedCategory) return;

    setIsScheduling(true);
    setScheduleError(null);

    try {
      const publishDateIso = buildPublishDate(publishDate, publishTime, timezone).toISOString();

      const response = await fetch("/api/schedule-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: articleData.title,
          markdown: articleData.markdown,
          html: articleData.html,
          metaDescription: articleData.metaDescription,
          keywords: generation.keywords.map((k) => k.text),
          category: selectedCategory,
          publishDateIso,
          originalPrompt: generation.originalPrompt,
          outline: generation.outline,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? `Request failed with status ${response.status}`);
      }

      setScheduleResult({
        articleId: data.articleId,
        publishPreview: formatPublishPreview(publishDate, publishTime, timezone),
      });
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : "Scheduling failed for an unknown reason.");
    } finally {
      setIsScheduling(false);
    }
  }

  function handleBackToArticle() {
    setCurrentStep(3);
  }

  async function handlePublishNow() {
    if (!scheduleResult) return;

    setIsPublishing(true);
    setPublishError(null);

    try {
      const response = await fetch("/api/publish-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article_id: scheduleResult.articleId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? `Request failed with status ${response.status}`);
      }

      setIsPublished(true);
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Publish failed for an unknown reason.");
    } finally {
      setIsPublishing(false);
    }
  }

  function renderStepOne() {
    if (generation) {
      return (
        <StepOneResults
          research={generation.research}
          outline={generation.outline}
          keywords={generation.keywords}
          extractedTopic={generation.extractedTopic}
          isEditingKeywords={isEditingKeywords}
          keywordsDraft={keywordsDraft}
          onToggleEditKeywords={handleToggleEditKeywords}
          onKeywordsDraftChange={setKeywordsDraft}
          onSaveKeywords={handleSaveKeywords}
          onApprove={handleApprove}
          onStartOver={handleStartOver}
        />
      );
    }

    return (
      <StepOneOutline
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
        prompt={prompt}
        onPromptChange={setPrompt}
        isLoading={isLoading}
        error={generateError}
        onGenerate={handleGenerate}
      />
    );
  }

  function renderMain() {
    if (currentStep === 1) {
      return renderStepOne();
    }

    if (currentStep === 2 && generation) {
      return (
        <StepTwoReview
          outline={generation.outline}
          keywords={generation.keywords}
          onAddKeyword={handleAddKeywordStep2}
          onRemoveKeyword={handleRemoveKeywordStep2}
          onApproveAndGenerate={handleApproveAndGenerate}
          onEditKeywords={handleEditKeywordsFromStep2}
          onRestart={handleRestart}
        />
      );
    }

    if (currentStep === 3) {
      return (
        <StepThreeArticle
          data={articleData}
          isLoading={isArticleLoading}
          error={articleError}
          onApproveAndSchedule={handleApproveAndSchedule}
          onRequestEdits={handleRequestEdits}
          onRetry={handleRetryArticle}
          onBack={handleBackToStepTwo}
        />
      );
    }

    if (currentStep === 4 && generation && articleData) {
      return (
        <StepFourSchedule
          article={{
            title: articleData.title,
            metaDescription: articleData.metaDescription,
            readingTimeMinutes: articleData.readingTimeMinutes,
            checklist: articleData.checklist,
          }}
          category={selectedCategory}
          onCategoryChange={setSelectedCategory}
          publishDate={publishDate}
          publishTime={publishTime}
          timezone={timezone}
          onPublishDateChange={setPublishDate}
          onPublishTimeChange={setPublishTime}
          onTimezoneChange={setTimezone}
          isSubmitting={isScheduling}
          submitError={scheduleError}
          scheduleResult={scheduleResult}
          onSchedule={handleSchedule}
          onBackToArticle={handleBackToArticle}
          onNextBlog={handleRestart}
          isPublishing={isPublishing}
          publishError={publishError}
          isPublished={isPublished}
          onPublishNow={handlePublishNow}
        />
      );
    }

    return <StepPlaceholder step={currentStep} onBack={handleReset} />;
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentStep={currentStep} finalStepComplete={scheduleResult !== null} />
        <main className="flex-1 overflow-y-auto px-8 py-10">{renderMain()}</main>
      </div>
    </div>
  );
}
