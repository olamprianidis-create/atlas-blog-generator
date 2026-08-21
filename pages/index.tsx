import { useState } from "react";
import Header from "../components/layout/Header";
import Sidebar from "../components/layout/Sidebar";
import StepOneTopic from "../components/steps/StepOneTopic";
import StepTwoImageKeywords, { KeywordItem } from "../components/steps/StepTwoImageKeywords";
import StepThreeOutline from "../components/steps/StepThreeOutline";
import StepFourArticle from "../components/steps/StepFourArticle";
import StepFiveSchedule, { ScheduleResult } from "../components/steps/StepFiveSchedule";
import StepPlaceholder from "../components/steps/StepPlaceholder";
import { Category, StepNumber } from "../utils/types";
import type { ResearchQuery } from "../utils/webSearch";
import type { BlogOutline } from "../utils/outline";
import type { KeywordResearchResult } from "../utils/keywordResearch";
import type { QualityCheckResult } from "../utils/qualityChecklist";
import { serializeOutline, parseOutlineText } from "../utils/outlineSerialize";
import { DEFAULT_TIMEZONE, buildPublishDate, formatPublishPreview } from "../utils/timezones";

interface ResearchKeywordsApiResponse {
  research: ResearchQuery[];
  keywordResearch: KeywordResearchResult;
  extractedTopic: string;
}

interface GenerateOutlineApiResponse {
  outline: BlogOutline;
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

  // Step 1: topic & prompt
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [prompt, setPrompt] = useState("");

  // Step 2: image & keywords
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [referenceKeywords, setReferenceKeywords] = useState("");
  const [isResearching, setIsResearching] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [keywordResearchResult, setKeywordResearchResult] = useState<KeywordResearchResult | null>(null);
  const [researchQueries, setResearchQueries] = useState<ResearchQuery[]>([]);
  const [extractedTopic, setExtractedTopic] = useState("");
  const [keywords, setKeywords] = useState<KeywordItem[]>([]);
  const [isEditingKeywords, setIsEditingKeywords] = useState(false);
  const [keywordsDraft, setKeywordsDraft] = useState("");

  // Step 3: outline approval
  const [outline, setOutline] = useState<BlogOutline | null>(null);
  const [outlineText, setOutlineText] = useState("");
  const [isOutlineLoading, setIsOutlineLoading] = useState(false);
  const [outlineError, setOutlineError] = useState<string | null>(null);

  // Step 4: full article
  const [articleData, setArticleData] = useState<ArticleRecord | null>(null);
  const [isArticleLoading, setIsArticleLoading] = useState(false);
  const [articleError, setArticleError] = useState<string | null>(null);

  // Step 5: schedule & store
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

  function handleProceedToStep2() {
    setCurrentStep(2);
    if (!keywordResearchResult) {
      void handleRunResearch();
    }
  }

  async function handleUploadImage(file: File) {
    setIsUploadingImage(true);
    setImageUploadError(null);

    try {
      const response = await fetch("/api/upload-image", {
        method: "POST",
        headers: { "Content-Type": file.type, "X-Filename": file.name },
        body: file,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? `Upload failed with status ${response.status}`);
      }

      setHeaderImageUrl(data.url as string);
    } catch (error) {
      setImageUploadError(error instanceof Error ? error.message : "Image upload failed for an unknown reason.");
    } finally {
      setIsUploadingImage(false);
    }
  }

  function handleRemoveImage() {
    setHeaderImageUrl(null);
    setImageUploadError(null);
  }

  function buildKeywordItems(result: KeywordResearchResult): KeywordItem[] {
    const recommendedTextSet = new Set(result.recommendations.map((t) => t.toLowerCase()));
    return [
      ...result.recommendations.map((text): KeywordItem => ({ text, isSuggested: true, source: "recommended" })),
      ...result.userKeywordsAnalyzed
        .filter((k) => !recommendedTextSet.has(k.keyword.toLowerCase()))
        .map((k): KeywordItem => ({ text: k.keyword, isSuggested: false, source: "reference" })),
    ];
  }

  async function handleRunResearch() {
    setIsResearching(true);
    setResearchError(null);

    try {
      const response = await fetch("/api/research-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCategory,
          prompt,
          userReferenceKeywords: referenceKeywords.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? `Request failed with status ${response.status}`);
      }

      const { research, keywordResearch, extractedTopic: newExtractedTopic } = data as ResearchKeywordsApiResponse;

      const newKeywords = buildKeywordItems(keywordResearch);
      setKeywordResearchResult(keywordResearch);
      setResearchQueries(research);
      setExtractedTopic(newExtractedTopic);
      setKeywords(newKeywords);
      setKeywordsDraft(newKeywords.map((k) => k.text).join(", "));
    } catch (error) {
      setResearchError(error instanceof Error ? error.message : "Keyword research failed for an unknown reason.");
    } finally {
      setIsResearching(false);
    }
  }

  function handleToggleEditKeywords() {
    setIsEditingKeywords((current) => !current);
  }

  function handleSaveKeywords() {
    const edited = Array.from(
      new Set(
        keywordsDraft
          .split(",")
          .map((k) => k.trim())
          .filter((k) => k.length > 0)
      )
    );

    setKeywords(edited.map((text) => ({ text, isSuggested: false })));
    setIsEditingKeywords(false);
  }

  function handleAddDiscoveredKeyword(text: string) {
    if (keywords.some((k) => k.text.toLowerCase() === text.toLowerCase())) return;

    const updatedKeywords: KeywordItem[] = [...keywords, { text, isSuggested: false, source: "custom" }];
    setKeywords(updatedKeywords);
    setKeywordsDraft(updatedKeywords.map((k) => k.text).join(", "));
  }

  async function handleProceedToStep3() {
    setCurrentStep(3);
    setIsOutlineLoading(true);
    setOutlineError(null);

    try {
      const response = await fetch("/api/generate-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCategory,
          prompt,
          extractedTopic,
          keywords: keywords.map((k) => k.text),
          research: researchQueries,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? `Request failed with status ${response.status}`);
      }

      const { outline: newOutline } = data as GenerateOutlineApiResponse;
      setOutline(newOutline);
      setOutlineText(serializeOutline(newOutline));
    } catch (error) {
      setOutlineError(error instanceof Error ? error.message : "Outline generation failed for an unknown reason.");
    } finally {
      setIsOutlineLoading(false);
    }
  }

  function handleBackToStep2() {
    setCurrentStep(2);
  }

  function handleRestart() {
    setSelectedCategory(null);
    setPrompt("");
    setHeaderImageUrl(null);
    setIsUploadingImage(false);
    setImageUploadError(null);
    setReferenceKeywords("");
    setIsResearching(false);
    setResearchError(null);
    setKeywordResearchResult(null);
    setResearchQueries([]);
    setExtractedTopic("");
    setKeywords([]);
    setIsEditingKeywords(false);
    setKeywordsDraft("");
    setOutline(null);
    setOutlineText("");
    setIsOutlineLoading(false);
    setOutlineError(null);
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

  async function fetchArticle(outlineArg: BlogOutline, editInstructions?: string) {
    setIsArticleLoading(true);
    setArticleError(null);

    try {
      const response = await fetch("/api/generate-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCategory,
          topic: extractedTopic || prompt,
          outline: outlineArg,
          keywords: keywords.map((k) => k.text),
          research: researchQueries,
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

  function handleApproveOutline() {
    const parsed = parseOutlineText(outlineText);
    setOutline(parsed);
    setCurrentStep(4);
    void fetchArticle(parsed);
  }

  function handleRequestEdits(instructions: string) {
    if (!outline) return;
    void fetchArticle(outline, instructions);
  }

  function handleRetryArticle() {
    if (!outline) return;
    void fetchArticle(outline);
  }

  function handleBackToStep3() {
    setCurrentStep(3);
  }

  function handleApproveAndSchedule() {
    setScheduleResult(null);
    setScheduleError(null);
    setIsPublished(false);
    setPublishError(null);
    setCurrentStep(5);
  }

  async function handleSchedule() {
    if (!articleData || !selectedCategory) return;

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
          keywords: keywords.map((k) => k.text),
          category: selectedCategory,
          publishDateIso,
          originalPrompt: prompt,
          outline,
          keywordResearch: keywordResearchResult,
          imageUrl: headerImageUrl,
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

  function handleBackToStep4() {
    setCurrentStep(4);
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

  function renderMain() {
    if (currentStep === 1) {
      return (
        <StepOneTopic
          selectedCategory={selectedCategory}
          onSelectCategory={handleSelectCategory}
          prompt={prompt}
          onPromptChange={setPrompt}
          onNext={handleProceedToStep2}
        />
      );
    }

    if (currentStep === 2) {
      return (
        <StepTwoImageKeywords
          headerImageUrl={headerImageUrl}
          isUploadingImage={isUploadingImage}
          imageUploadError={imageUploadError}
          onUploadImage={handleUploadImage}
          onRemoveImage={handleRemoveImage}
          referenceKeywords={referenceKeywords}
          onReferenceKeywordsChange={setReferenceKeywords}
          keywordResearch={keywordResearchResult}
          isResearching={isResearching}
          researchError={researchError}
          onRunResearch={handleRunResearch}
          keywords={keywords}
          isEditingKeywords={isEditingKeywords}
          keywordsDraft={keywordsDraft}
          onToggleEditKeywords={handleToggleEditKeywords}
          onKeywordsDraftChange={setKeywordsDraft}
          onSaveKeywords={handleSaveKeywords}
          onAddDiscoveredKeyword={handleAddDiscoveredKeyword}
          onBack={() => setCurrentStep(1)}
          onNext={handleProceedToStep3}
        />
      );
    }

    if (currentStep === 3) {
      return (
        <StepThreeOutline
          outlineText={outlineText}
          onOutlineTextChange={setOutlineText}
          isLoading={isOutlineLoading}
          error={outlineError}
          onBack={handleBackToStep2}
          onApprove={handleApproveOutline}
        />
      );
    }

    if (currentStep === 4) {
      return (
        <StepFourArticle
          data={articleData}
          isLoading={isArticleLoading}
          error={articleError}
          onApproveAndSchedule={handleApproveAndSchedule}
          onRequestEdits={handleRequestEdits}
          onRetry={handleRetryArticle}
          onBack={handleBackToStep3}
        />
      );
    }

    if (currentStep === 5 && articleData) {
      return (
        <StepFiveSchedule
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
          onBackToArticle={handleBackToStep4}
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
