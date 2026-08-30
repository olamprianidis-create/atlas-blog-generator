import { useState } from "react";
import Link from "next/link";
import PlatformPicker from "./PlatformPicker";
import UploadForm from "./UploadForm";
import NoteRichTextEditor from "./NoteRichTextEditor";
import { Platform, PLATFORMS } from "../utils/types";

export interface ScheduledArticleForDay {
  id: string;
  title: string;
  image_url: string | null;
  status: "scheduled" | "published";
}

export interface CalendarEventItem {
  id: string;
  event_date: string;
  platforms: string[];
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  completed_platforms: string[];
}

export interface VideoUploadForDay {
  key: string;
  uploadId: string;
  platform: "youtube" | "tiktok";
  title: string;
  status: string;
  externalId: string | null;
}

interface CalendarDayModalProps {
  dateStr: string;
  scheduledArticles: ScheduledArticleForDay[];
  videoUploads: VideoUploadForDay[];
  events: CalendarEventItem[];
  onClose: () => void;
  onEventCreated: (event: CalendarEventItem) => void;
  onEventUpdated: (event: CalendarEventItem) => void;
  onEventDeleted: (eventId: string) => void;
  onArticleDeleted: (articleId: string) => void;
  onVideoDeleted: (uploadId: string) => void;
  onVideoUploaded: () => void;
}

function TrashButton({ onClick, label }: { onClick: (e: React.MouseEvent) => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
        <path
          d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function formatDateLabel(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function platformMeta(value: string) {
  return PLATFORMS.find((p) => p.value === value);
}

function platformColorClass(value: string) {
  return platformMeta(value)?.colorClass ?? "bg-slate-400";
}

interface EventFormProps {
  initialTitle: string;
  initialPlatforms: Platform[];
  initialDescription: string;
  initialThumbnailUrl: string | null;
  submitLabel: string;
  savingLabel: string;
  onCancel: () => void;
  onSubmit: (data: { title: string; platforms: Platform[]; description: string; thumbnailUrl: string | null }) => Promise<void>;
  onDelete?: () => Promise<void>;
  deleteLabel?: string;
  deletingLabel?: string;
}

function EventForm({
  initialTitle,
  initialPlatforms,
  initialDescription,
  initialThumbnailUrl,
  submitLabel,
  savingLabel,
  onCancel,
  onSubmit,
  onDelete,
  deleteLabel = "Delete",
  deletingLabel = "Deleting...",
}: EventFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [platforms, setPlatforms] = useState<Platform[]>(initialPlatforms);
  const [description, setDescription] = useState(initialDescription);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(initialThumbnailUrl);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleThumbnailSelect(file: File) {
    setIsUploadingThumbnail(true);
    setError(null);
    try {
      const response = await fetch("/api/upload-image", {
        method: "POST",
        headers: { "Content-Type": file.type, "X-Filename": file.name },
        body: file,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Thumbnail upload failed");
      setThumbnailUrl(data.url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thumbnail upload failed");
    } finally {
      setIsUploadingThumbnail(false);
    }
  }

  async function handleSubmit() {
    if (!title.trim()) {
      setError("Give this note a header first.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSubmit({ title: title.trim(), platforms, description, thumbnailUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save event");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!window.confirm("Delete this event? This can't be undone.")) return;
    setIsDeleting(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete event");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div>
        <label htmlFor="event-title" className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
          Header <span className="font-normal normal-case text-slate-400">(shown on the main calendar)</span>
        </label>
        <input
          id="event-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Draft Instagram caption"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Platform <span className="font-normal normal-case text-slate-400">(optional)</span>
        </p>
        <PlatformPicker selected={platforms} onChange={setPlatforms} />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Description <span className="font-normal normal-case text-slate-400">(only shown when you open the note)</span>
        </p>
        <NoteRichTextEditor value={description} onChange={setDescription} placeholder="What's the plan for this post?" />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Thumbnail <span className="font-normal normal-case text-slate-400">(optional)</span>
        </p>
        {thumbnailUrl ? (
          <div className="flex items-center gap-3">
            <img src={thumbnailUrl} alt="" className="h-14 w-14 rounded-md object-cover" />
            <button
              type="button"
              onClick={() => setThumbnailUrl(null)}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              Remove
            </button>
          </div>
        ) : (
          <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-300 text-slate-400 hover:border-slate-400">
            {isUploadingThumbnail ? (
              <span className="text-[10px]">...</span>
            ) : (
              <span className="text-lg leading-none">+</span>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isUploadingThumbnail}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleThumbnailSelect(file);
              }}
            />
          </label>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center justify-between gap-2">
        {onDelete ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? deletingLabel : deleteLabel}
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? savingLabel : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function platformDisplayLabel(value: string) {
  return platformMeta(value)?.label ?? value;
}

function videoStatusLabel(status: string) {
  switch (status) {
    case "published":
      return "Published";
    case "publishing":
      return "Publishing…";
    case "pending":
      return "Scheduled";
    case "failed":
      return "Failed";
    case "not_connected":
      return "Not connected";
    default:
      return status;
  }
}

function videoWatchUrl(platform: "youtube" | "tiktok", externalId: string | null) {
  if (!externalId) return null;
  if (platform === "youtube") return `https://youtube.com/watch?v=${externalId}`;
  return null; // TikTok's publish_id isn't a public post id we can link to directly.
}

export default function CalendarDayModal({
  dateStr,
  scheduledArticles,
  videoUploads,
  events,
  onClose,
  onEventCreated,
  onEventUpdated,
  onEventDeleted,
  onArticleDeleted,
  onVideoDeleted,
  onVideoUploaded,
}: CalendarDayModalProps) {
  const [addMode, setAddMode] = useState<"menu" | "upload" | "note" | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [deletingArticleId, setDeletingArticleId] = useState<string | null>(null);
  const [deletingUploadId, setDeletingUploadId] = useState<string | null>(null);

  async function handleDeleteArticle(article: ScheduledArticleForDay) {
    const confirmed = window.confirm(
      article.status === "published"
        ? `Permanently delete "${article.title}"? It's already live — this removes it from the ATLAS Website immediately, not just from this calendar. This can't be undone.`
        : `Delete the scheduled draft "${article.title}"? This can't be undone.`
    );
    if (!confirmed) return;

    setDeletingArticleId(article.id);
    try {
      const response = await fetch(`/api/scheduled-articles/${article.id}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error ?? "Failed to delete article");
      }
      onArticleDeleted(article.id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to delete article");
    } finally {
      setDeletingArticleId(null);
    }
  }

  async function handleDeleteVideo(video: VideoUploadForDay) {
    const confirmed = window.confirm(
      video.status === "published"
        ? `Remove "${video.title}" from our records? It's already live on ${video.platform === "youtube" ? "YouTube" : "TikTok"} — this only deletes our tracking of it, it does NOT un-publish or delete the actual video there.`
        : `Delete "${video.title}"? This can't be undone.`
    );
    if (!confirmed) return;

    setDeletingUploadId(video.uploadId);
    try {
      const response = await fetch(`/api/uploads/${video.uploadId}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error ?? "Failed to delete upload");
      }
      onVideoDeleted(video.uploadId);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to delete upload");
    } finally {
      setDeletingUploadId(null);
    }
  }

  async function handleCreate(data: { title: string; platforms: Platform[]; description: string; thumbnailUrl: string | null }) {
    const response = await fetch("/api/calendar/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventDate: dateStr,
        platforms: data.platforms,
        title: data.title,
        description: data.description.trim() || undefined,
        thumbnailUrl: data.thumbnailUrl || undefined,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Failed to save event");
    onEventCreated(result as CalendarEventItem);
    setAddMode(null);
  }

  async function handleUpdate(
    eventId: string,
    data: { title: string; platforms: Platform[]; description: string; thumbnailUrl: string | null }
  ) {
    const response = await fetch(`/api/calendar/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platforms: data.platforms,
        title: data.title,
        description: data.description.trim() || undefined,
        thumbnailUrl: data.thumbnailUrl || undefined,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Failed to update event");
    onEventUpdated(result as CalendarEventItem);
    setEditingEventId(null);
  }

  async function handleDelete(eventId: string) {
    const response = await fetch(`/api/calendar/events/${eventId}`, { method: "DELETE" });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error ?? "Failed to delete event");
    }
    onEventDeleted(eventId);
    setEditingEventId(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full flex-col overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold text-slate-900">{formatDateLabel(dateStr)}</h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {scheduledArticles.length === 0 && videoUploads.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
              Nothing to see here.
            </p>
          )}

          {scheduledArticles.length > 0 &&
            scheduledArticles.map((article) => (
              <div key={article.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                {article.image_url ? (
                  <img src={article.image_url} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-300">
                    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                      <path
                        d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path d="m4 16 4.5-4.5a2 2 0 0 1 2.8 0L16 16" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="15.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </div>
                )}
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{article.title}</p>
                <Link
                  href={
                    article.status === "published"
                      ? `/published/${article.id}/stats`
                      : `/?scheduledId=${article.id}`
                  }
                  className="shrink-0 whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  {article.status === "published" ? "View Statistics" : "View Scheduled Post"}
                </Link>
                <TrashButton
                  label="Delete article"
                  onClick={() => {
                    if (deletingArticleId !== article.id) void handleDeleteArticle(article);
                  }}
                />
              </div>
            ))}

          {videoUploads.length > 0 &&
            videoUploads.map((video) => {
              const watchUrl = videoWatchUrl(video.platform, video.externalId);
              return (
                <div
                  key={video.key}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"
                >
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium text-white ${platformColorClass(video.platform)}`}
                  >
                    {platformDisplayLabel(video.platform)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{video.title}</p>
                    <p className="text-xs text-slate-500">{videoStatusLabel(video.status)}</p>
                  </div>
                  {watchUrl && (
                    <a
                      href={watchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      View
                    </a>
                  )}
                  <TrashButton
                    label="Delete upload"
                    onClick={() => {
                      if (deletingUploadId !== video.uploadId) void handleDeleteVideo(video);
                    }}
                  />
                </div>
              );
            })}
        </div>

        {events.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {events.map((event) =>
              editingEventId === event.id ? (
                <EventForm
                  key={event.id}
                  initialTitle={event.title ?? ""}
                  initialPlatforms={event.platforms as Platform[]}
                  initialDescription={event.description ?? ""}
                  initialThumbnailUrl={event.thumbnail_url}
                  submitLabel="Save Changes"
                  savingLabel="Saving..."
                  onCancel={() => setEditingEventId(null)}
                  onSubmit={(data) => handleUpdate(event.id, data)}
                  onDelete={() => handleDelete(event.id)}
                />
              ) : (
                // A div, not a <button> — it now contains a nested
                // interactive TrashButton, and nesting a real button
                // inside another button is invalid HTML that silently
                // breaks click handling.
                <div
                  key={event.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setEditingEventId(event.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setEditingEventId(event.id);
                    }
                  }}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left transition-colors hover:border-amber-300 hover:bg-amber-100"
                >
                  {event.thumbnail_url ? (
                    <img src={event.thumbnail_url} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded-md bg-amber-200" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{event.title || "Untitled note"}</p>
                    {event.platforms.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {event.platforms.map((p) => {
                          const meta = platformMeta(p);
                          return (
                            <span
                              key={p}
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium text-white ${meta?.colorClass ?? "bg-slate-400"}`}
                            >
                              {meta?.label ?? p}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {event.description && (
                      <div
                        className="mt-1 whitespace-pre-wrap text-xs text-slate-600 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                        dangerouslySetInnerHTML={{ __html: event.description }}
                      />
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-medium text-amber-700">Edit</span>
                  <TrashButton
                    label="Delete note"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!window.confirm("Delete this note? This can't be undone.")) return;
                      void handleDelete(event.id);
                    }}
                  />
                </div>
              )
            )}
          </div>
        )}

        <div className="mt-4">
          {addMode === null && (
            <button
              type="button"
              onClick={() => setAddMode("menu")}
              aria-label="Add to this day"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}

          {addMode === "menu" && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAddMode("upload")}
                className="flex flex-1 flex-col items-center gap-1 rounded-lg border border-slate-200 px-4 py-3 text-center hover:border-blue-300 hover:bg-blue-50/40"
              >
                <span className="text-sm font-semibold text-slate-900">Upload</span>
                <span className="text-xs text-slate-500">Post a video to YouTube / TikTok on this day</span>
              </button>
              <button
                type="button"
                onClick={() => setAddMode("note")}
                className="flex flex-1 flex-col items-center gap-1 rounded-lg border border-slate-200 px-4 py-3 text-center hover:border-blue-300 hover:bg-blue-50/40"
              >
                <span className="text-sm font-semibold text-slate-900">Notes</span>
                <span className="text-xs text-slate-500">A quick reminder that shows on this day</span>
              </button>
              <button
                type="button"
                onClick={() => setAddMode(null)}
                aria-label="Cancel"
                className="shrink-0 self-start rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
          )}

          {addMode === "upload" && (
            <UploadForm
              initialDateStr={dateStr}
              onCancel={() => setAddMode(null)}
              onSuccess={() => {
                onVideoUploaded();
                setAddMode(null);
              }}
            />
          )}

          {addMode === "note" && (
            <EventForm
              initialTitle=""
              initialPlatforms={[]}
              initialDescription=""
              initialThumbnailUrl={null}
              submitLabel="Add Note"
              savingLabel="Saving..."
              onCancel={() => setAddMode(null)}
              onSubmit={handleCreate}
            />
          )}
        </div>
      </div>
    </div>
  );
}
