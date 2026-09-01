import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AppLayout from "../components/layout/AppLayout";
import Sidebar from "../components/layout/Sidebar";
import SaveDraftButton from "../components/layout/SaveDraftButton";
import StepOneTopic from "../components/steps/StepOneTopic";
import type { UploadedDocument } from "../components/steps/DocumentUpload";
import StepTwoImageKeywords, { KeywordItem } from "../components/steps/StepTwoImageKeywords";
import StepThreeOutline from "../components/steps/StepThreeOutline";
import StepFourArticle from "../components/steps/StepFourArticle";
import StepFiveSchedule, { ScheduleResult } from "../components/steps/StepFiveSchedule";
import StepPlaceholder from "../components/steps/StepPlaceholder";
import { Category, StepNumber } from "../utils/types";
import type { ResearchQuery } from "../utils/webSearch";
import type { BlogOutline } from "../utils/outline";
import type { KeywordResearchResult } from "../utils/keywordResearch";
import { runQualityChecklist, type QualityCheckResult } from "../utils/qualityChecklist";
import { countWords, calculateReadingTime } from "../utils/markdown";
import { serializeOutline, parseOutlineText } from "../utils/outlineSerialize";
import { DEFAULT_TIMEZONE, buildPublishDate, formatPublishPreview, parsePublishDate } from "../utils/timezones";
import type { RelatedArticleItem } from "../utils/relatedArticles";

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

interface DraftState {
  selectedCategory: Category | null;
  prompt: string;
  preliminaryKeywords: string;
  authorUserId: string | null;
  referenceDocuments: UploadedDocument[];
  headerImageUrl: string | null;
  referenceKeywords: string;
  keywordResearchResult: KeywordResearchResult | null;
  researchQueries: ResearchQuery[];
  extractedTopic: string;
  keywords: KeywordItem[];
  outline: BlogOutline | null;
  outlineText: string;
  articleData: ArticleRecord | null;
  publishDate: string;
  publishTime: string;
  timezone: string;
}

interface ResearchSignatureInput {
  selectedCategory: Category | null;
  prompt: string;
  referenceKeywords: string;
  preliminaryKeywords: string;
}

interface OutlineSignatureInput {
  selectedCategory: Category | null;
  extractedTopic: string;
  keywordTexts: string[];
  documentKeys: string[];
}

interface ArticleSignatureInput {
  selectedCategory: Category | null;
  topic: string;
  outline: BlogOutline;
  keywordTexts: string[];
  documentKeys: string[];
}

// A cheap stand-in for "did the uploaded documents change" — name +
// extracted length is enough to detect an add/remove/replace without
// embedding the full extracted text (already large) into every signature.
function documentKeysFor(documents: UploadedDocument[]): string[] {
  return documents.map((d) => `${d.name}:${d.charCount}`);
}

function computeResearchSignature(input: ResearchSignatureInput): string {
  return JSON.stringify(input);
}

function computeOutlineSignature(input: OutlineSignatureInput): string {
  return JSON.stringify(input);
}

function computeArticleSignature(input: ArticleSignatureInput): string {
  return JSON.stringify(input);
}

export default function Home() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [maxStepReached, setMaxStepReached] = useState<StepNumber>(1);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);

  // Step 1: topic & prompt
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [prompt, setPrompt] = useState("");
  const [preliminaryKeywords, setPreliminaryKeywords] = useState("");
  const [authorUserId, setAuthorUserId] = useState<string | null>(null);
  const [referenceDocuments, setReferenceDocuments] = useState<UploadedDocument[]>([]);

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
  const [lastResearchSignature, setLastResearchSignature] = useState<string | null>(null);

  // Step 3: outline approval
  const [outline, setOutline] = useState<BlogOutline | null>(null);
  const [outlineText, setOutlineText] = useState("");
  const [isOutlineLoading, setIsOutlineLoading] = useState(false);
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [lastOutlineSignature, setLastOutlineSignature] = useState<string | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<RelatedArticleItem[]>([]);
  const [lastArticleSignature, setLastArticleSignature] = useState<string | null>(null);

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
  const [isDeletingArticle, setIsDeletingArticle] = useState(false);
  const [deleteArticleError, setDeleteArticleError] = useState<string | null>(null);

  useEffect(() => {
    setMaxStepReached((current) => (currentStep > current ? currentStep : current));
  }, [currentStep]);

  function handleSelectCategory(category: Category) {
    setSelectedCategory((current) => (current === category ? null : category));
  }

  function handleProceedToStep2() {
    setCurrentStep(2);
    const signature = computeResearchSignature({
      selectedCategory,
      prompt,
      referenceKeywords,
      preliminaryKeywords,
    });
    if (!keywordResearchResult || signature !== lastResearchSignature) {
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

  async function handleRunResearch(allowMoreTokens = false) {
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
          preliminaryKeywords: preliminaryKeywords.trim() || undefined,
          allowMoreTokens: allowMoreTokens || undefined,
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
      setLastResearchSignature(
        computeResearchSignature({ selectedCategory, prompt, referenceKeywords, preliminaryKeywords })
      );
    } catch (error) {
      setResearchError(error instanceof Error ? error.message : "Keyword research failed for an unknown reason.");
    } finally {
      setIsResearching(false);
    }
  }

  function handleRetryResearchWithMoreTokens() {
    void handleRunResearch(true);
  }

  function handleContinueWithoutResearch() {
    setResearchError(null);
    void handleProceedToStep3();
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

    const signature = computeOutlineSignature({
      selectedCategory,
      extractedTopic,
      keywordTexts: keywords.map((k) => k.text),
      documentKeys: documentKeysFor(referenceDocuments),
    });
    if (outline && signature === lastOutlineSignature) {
      // Nothing changed since the last time this outline was generated —
      // just navigate there and preserve whatever the user already edited.
      return;
    }

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
          documents: referenceDocuments,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? `Request failed with status ${response.status}`);
      }

      const { outline: newOutline } = data as GenerateOutlineApiResponse;
      setOutline(newOutline);
      setOutlineText(serializeOutline(newOutline));
      setLastOutlineSignature(signature);
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
    setPreliminaryKeywords("");
    setAuthorUserId(null);
    setReferenceDocuments([]);
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
    setLastResearchSignature(null);
    setOutline(null);
    setOutlineText("");
    setIsOutlineLoading(false);
    setOutlineError(null);
    setLastOutlineSignature(null);
    setLastArticleSignature(null);
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
    setMaxStepReached(1);
    setDraftId(null);
    setEditingArticleId(null);
  }

  function handleReset() {
    setCurrentStep(1);
  }

  function buildDraftState(): DraftState {
    return {
      selectedCategory,
      prompt,
      preliminaryKeywords,
      authorUserId,
      referenceDocuments,
      headerImageUrl,
      referenceKeywords,
      keywordResearchResult,
      researchQueries,
      extractedTopic,
      keywords,
      outline,
      outlineText,
      articleData,
      publishDate,
      publishTime,
      timezone,
    };
  }

  function applyDraftState(state: DraftState) {
    setSelectedCategory(state.selectedCategory);
    setPrompt(state.prompt);
    setPreliminaryKeywords(state.preliminaryKeywords ?? "");
    setAuthorUserId(state.authorUserId ?? null);
    setReferenceDocuments(state.referenceDocuments ?? []);
    setHeaderImageUrl(state.headerImageUrl);
    setReferenceKeywords(state.referenceKeywords);
    setKeywordResearchResult(state.keywordResearchResult);
    setResearchQueries(state.researchQueries);
    setExtractedTopic(state.extractedTopic);
    setKeywords(state.keywords);
    setOutline(state.outline);
    setOutlineText(state.outlineText);
    setArticleData(state.articleData);
    setPublishDate(state.publishDate);
    setPublishTime(state.publishTime);
    setTimezone(state.timezone);

    // Re-derive "last generated with these inputs" signatures from the
    // loaded state so resuming a draft doesn't look "changed" and force
    // an unnecessary (paid) regeneration the moment the user hits Next.
    if (state.keywordResearchResult) {
      setLastResearchSignature(
        computeResearchSignature({
          selectedCategory: state.selectedCategory,
          prompt: state.prompt,
          referenceKeywords: state.referenceKeywords,
          preliminaryKeywords: state.preliminaryKeywords ?? "",
        })
      );
    }
    const documentKeys = documentKeysFor(state.referenceDocuments ?? []);
    if (state.outline) {
      setLastOutlineSignature(
        computeOutlineSignature({
          selectedCategory: state.selectedCategory,
          extractedTopic: state.extractedTopic,
          keywordTexts: state.keywords.map((k) => k.text),
          documentKeys,
        })
      );
    }
    if (state.outline && state.articleData) {
      setLastArticleSignature(
        computeArticleSignature({
          selectedCategory: state.selectedCategory,
          topic: state.extractedTopic || state.prompt,
          outline: state.outline,
          keywordTexts: state.keywords.map((k) => k.text),
          documentKeys,
        })
      );
    }
  }

  async function handleSaveDraft() {
    const title =
      articleData?.title || extractedTopic || prompt.slice(0, 60) || "Untitled draft";

    const response = await fetch("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: draftId,
        title,
        category: selectedCategory,
        currentStep,
        state: buildDraftState(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? `Request failed with status ${response.status}`);
    }

    setDraftId(data.id as string);
  }

  useEffect(() => {
    if (!router.isReady) return;

    const draftParam = router.query.draft;
    if (typeof draftParam === "string" && draftParam) {
      setIsLoadingDraft(true);
      fetch(`/api/drafts/${draftParam}`)
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "Failed to load draft");
          applyDraftState(data.state as DraftState);
          setCurrentStep((data.current_step as StepNumber) ?? 1);
          setDraftId(data.id as string);
        })
        .catch((error) => {
          console.error("Failed to load draft:", error);
        })
        .finally(() => setIsLoadingDraft(false));
      return;
    }

    const scheduledIdParam = router.query.scheduledId;
    if (typeof scheduledIdParam === "string" && scheduledIdParam) {
      setIsLoadingDraft(true);
      fetch(`/api/scheduled-articles/${scheduledIdParam}`)
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "Failed to load scheduled article");

          const articleKeywords: string[] = Array.isArray(data.keywords) ? data.keywords : [];
          const wordCount = countWords(data.content_markdown ?? "");
          const checklist = runQualityChecklist({
            markdown: data.content_markdown ?? "",
            metaDescription: data.meta_description ?? "",
            mainKeyword: articleKeywords[0] ?? "",
            longTailKeywords: articleKeywords.slice(1),
          });

          setSelectedCategory(data.category as Category);
          setKeywords(articleKeywords.map((text): KeywordItem => ({ text, isSuggested: false })));
          setHeaderImageUrl(data.image_url ?? null);
          setAuthorUserId(data.author_user_id ?? null);
          setArticleData({
            title: data.title,
            markdown: data.content_markdown,
            html: data.content_html ?? "",
            metaDescription: data.meta_description,
            wordCount,
            readingTimeMinutes: calculateReadingTime(wordCount),
            checklist,
          });

          if (typeof data.publish_date === "string" && data.publish_date) {
            const { date, time } = parsePublishDate(data.publish_date, DEFAULT_TIMEZONE);
            setPublishDate(date);
            setPublishTime(time);
            setTimezone(DEFAULT_TIMEZONE);
          }

          setScheduleResult(null);
          setScheduleError(null);
          setEditingArticleId(data.id as string);
          setCurrentStep(5);
        })
        .catch((error) => {
          console.error("Failed to load scheduled article:", error);
        })
        .finally(() => setIsLoadingDraft(false));
    }
    // Only run once router params are ready — this shouldn't re-fire as
    // the user edits wizard state afterward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

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
          documents: referenceDocuments,
          relatedArticles,
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
      setLastArticleSignature(
        computeArticleSignature({
          selectedCategory,
          topic: extractedTopic || prompt,
          outline: outlineArg,
          keywordTexts: keywords.map((k) => k.text),
          documentKeys: documentKeysFor(referenceDocuments),
        })
      );
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

    const signature = computeArticleSignature({
      selectedCategory,
      topic: extractedTopic || prompt,
      outline: parsed,
      keywordTexts: keywords.map((k) => k.text),
      documentKeys: documentKeysFor(referenceDocuments),
    });
    if (articleData && signature === lastArticleSignature) {
      // Outline is unchanged since the last generated article — just
      // navigate there and keep the existing article (and any edits).
      return;
    }

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
          authorUserId,
          articleId: editingArticleId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? `Request failed with status ${response.status}`);
      }

      setEditingArticleId(data.articleId);
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
    const articleIdToPublish = scheduleResult?.articleId ?? editingArticleId;
    if (!articleIdToPublish) return;

    setIsPublishing(true);
    setPublishError(null);

    try {
      const response = await fetch("/api/publish-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article_id: articleIdToPublish }),
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

  async function handleDeleteArticle() {
    if (!editingArticleId) return;
    if (!window.confirm("Delete this article from the website and database? This can't be undone.")) return;

    setIsDeletingArticle(true);
    setDeleteArticleError(null);

    try {
      const response = await fetch(`/api/scheduled-articles/${editingArticleId}`, { method: "DELETE" });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed with status ${response.status}`);
      }

      void router.push("/scheduled");
    } catch (error) {
      setDeleteArticleError(error instanceof Error ? error.message : "Delete failed for an unknown reason.");
    } finally {
      setIsDeletingArticle(false);
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
          preliminaryKeywords={preliminaryKeywords}
          onPreliminaryKeywordsChange={setPreliminaryKeywords}
          authorUserId={authorUserId}
          onAuthorChange={setAuthorUserId}
          referenceDocuments={referenceDocuments}
          onReferenceDocumentsChange={setReferenceDocuments}
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
          onRunResearch={() => handleRunResearch()}
          onRetryResearchWithMoreTokens={handleRetryResearchWithMoreTokens}
          onContinueWithoutResearch={handleContinueWithoutResearch}
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
          category={selectedCategory}
          topic={extractedTopic || prompt}
          onRelatedArticlesChange={setRelatedArticles}
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
          articleId={scheduleResult?.articleId ?? editingArticleId}
          isEditingExisting={editingArticleId !== null}
          onDelete={handleDeleteArticle}
          isDeleting={isDeletingArticle}
          deleteError={deleteArticleError}
        />
      );
    }

    return <StepPlaceholder step={currentStep} onBack={handleReset} />;
  }

  return (
    <AppLayout contentClassName="flex flex-1 overflow-hidden">
      <Sidebar
        currentStep={currentStep}
        maxStepReached={maxStepReached}
        onSelectStep={setCurrentStep}
        finalStepComplete={scheduleResult !== null}
      />
      <main className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mb-6 flex justify-end">
          <SaveDraftButton
            onSave={handleSaveDraft}
            disabled={isLoadingDraft || (!selectedCategory && !prompt.trim())}
          />
        </div>
        {renderMain()}
      </main>
    </AppLayout>
  );
}
