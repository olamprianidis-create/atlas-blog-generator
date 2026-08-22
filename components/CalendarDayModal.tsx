import { useState } from "react";
import Link from "next/link";
import PlatformPicker from "./PlatformPicker";
import { Platform, PLATFORMS } from "../utils/types";

export interface ScheduledArticleForDay {
  id: string;
  title: string;
  image_url: string | null;
}

export interface CalendarEventItem {
  id: string;
  event_date: string;
  platforms: string[];
  description: string | null;
  thumbnail_url: string | null;
}

interface CalendarDayModalProps {
  dateStr: string;
  scheduledArticle: ScheduledArticleForDay | null;
  events: CalendarEventItem[];
  onClose: () => void;
  onEventCreated: (event: CalendarEventItem) => void;
  onEventUpdated: (event: CalendarEventItem) => void;
  onEventDeleted: (eventId: string) => void;
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

interface EventFormProps {
  initialPlatforms: Platform[];
  initialDescription: string;
  initialThumbnailUrl: string | null;
  submitLabel: string;
  savingLabel: string;
  onCancel: () => void;
  onSubmit: (data: { platforms: Platform[]; description: string; thumbnailUrl: string | null }) => Promise<void>;
  onDelete?: () => Promise<void>;
  deleteLabel?: string;
  deletingLabel?: string;
}

function EventForm({
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
    setIsSaving(true);
    setError(null);
    try {
      await onSubmit({ platforms, description, thumbnailUrl });
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
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Platform <span className="font-normal normal-case text-slate-400">(optional)</span>
        </p>
        <PlatformPicker selected={platforms} onChange={setPlatforms} />
      </div>

      <div>
        <label
          htmlFor="event-description"
          className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500"
        >
          Description <span className="font-normal normal-case text-slate-400">(optional)</span>
        </label>
        <textarea
          id="event-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          placeholder="What's the plan for this post?"
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
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

export default function CalendarDayModal({
  dateStr,
  scheduledArticle,
  events,
  onClose,
  onEventCreated,
  onEventUpdated,
  onEventDeleted,
}: CalendarDayModalProps) {
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  async function handleCreate(data: { platforms: Platform[]; description: string; thumbnailUrl: string | null }) {
    const response = await fetch("/api/calendar/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventDate: dateStr,
        platforms: data.platforms,
        description: data.description.trim() || undefined,
        thumbnailUrl: data.thumbnailUrl || undefined,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Failed to save event");
    onEventCreated(result as CalendarEventItem);
    setIsAddingEvent(false);
  }

  async function handleUpdate(
    eventId: string,
    data: { platforms: Platform[]; description: string; thumbnailUrl: string | null }
  ) {
    const response = await fetch(`/api/calendar/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platforms: data.platforms,
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

        <div className="mt-4">
          {scheduledArticle ? (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
              {scheduledArticle.image_url ? (
                <img
                  src={scheduledArticle.image_url}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-md object-cover"
                />
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
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                {scheduledArticle.title}
              </p>
              <Link
                href={`/?scheduledId=${scheduledArticle.id}`}
                className="shrink-0 whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                View Scheduled Post
              </Link>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
              Nothing to see here.
            </p>
          )}
        </div>

        {events.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {events.map((event) =>
              editingEventId === event.id ? (
                <EventForm
                  key={event.id}
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
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setEditingEventId(event.id)}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  {event.thumbnail_url ? (
                    <img src={event.thumbnail_url} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded-md bg-slate-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    {event.platforms.length > 0 && (
                      <div className="flex flex-wrap gap-1">
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
                      <p className="mt-1 truncate text-xs text-slate-600">{event.description}</p>
                    )}
                    {!event.description && event.platforms.length === 0 && (
                      <p className="mt-1 text-xs text-slate-400">Untitled event</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-medium text-slate-400">Edit</span>
                </button>
              )
            )}
          </div>
        )}

        <div className="mt-4">
          {!isAddingEvent ? (
            <button
              type="button"
              onClick={() => setIsAddingEvent(true)}
              aria-label="Add content calendar event"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          ) : (
            <EventForm
              initialPlatforms={[]}
              initialDescription=""
              initialThumbnailUrl={null}
              submitLabel="Add Event"
              savingLabel="Saving..."
              onCancel={() => setIsAddingEvent(false)}
              onSubmit={handleCreate}
            />
          )}
        </div>
      </div>
    </div>
  );
}
