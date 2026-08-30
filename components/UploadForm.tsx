import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import Spinner from "./Spinner";
import { YOUTUBE_CATEGORIES, TIKTOK_PRIVACY_OPTIONS } from "../utils/uploadConstants";

const inputClass =
  "w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const cardClass = "rounded-lg border border-slate-200 bg-white p-4";
const sectionLabelClass = "text-sm font-semibold uppercase tracking-wide text-slate-500";

interface UploadFormProps {
  // "YYYY-MM-DD" — when set (e.g. opened from a specific day on the
  // Content Calendar), seeds "Schedule for later" as checked with that
  // day at 9am, since the day was already picked by the admin.
  initialDateStr?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function UploadForm({ initialDateStr, onSuccess, onCancel }: UploadFormProps) {
  const [connections, setConnections] = useState<{ youtube: boolean; tiktok: boolean } | null>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const [targetYoutube, setTargetYoutube] = useState(true);
  const [youtubePrivacy, setYoutubePrivacy] = useState<"public" | "unlisted" | "private">("public");
  const [youtubeCategory, setYoutubeCategory] = useState("22");
  const [youtubeMadeForKids, setYoutubeMadeForKids] = useState(false);

  const [targetTiktok, setTargetTiktok] = useState(true);
  const [tiktokPrivacy, setTiktokPrivacy] = useState("PUBLIC_TO_EVERYONE");
  const [tiktokDisableComment, setTiktokDisableComment] = useState(false);
  const [tiktokDisableDuet, setTiktokDisableDuet] = useState(false);
  const [tiktokDisableStitch, setTiktokDisableStitch] = useState(false);
  const [tiktokCoverSeconds, setTiktokCoverSeconds] = useState(1);

  const [scheduleLater, setScheduleLater] = useState(!!initialDateStr);
  const [publishAt, setPublishAt] = useState(initialDateStr ? `${initialDateStr}T09:00` : "");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  function loadConnections() {
    fetch("/api/platform-connections")
      .then((res) => res.json())
      .then((data) => setConnections(data))
      .catch(() => setConnections({ youtube: false, tiktok: false }));
  }

  useEffect(() => {
    loadConnections();
  }, []);

  useEffect(() => {
    // Connect links open in a new tab (so an in-progress form here isn't
    // lost) — pick up the result when the admin comes back to this tab.
    function onFocus() {
      loadConnections();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  async function handleVideoSelect(file: File) {
    setVideoError(null);
    setVideoFile(file);
    setVideoUrl(null);
    setVideoProgress(0);

    try {
      const blob = await upload(`uploads/${Date.now()}-${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/upload-video",
        onUploadProgress: (event) => setVideoProgress(event.percentage),
      });
      setVideoUrl(blob.url);
    } catch (error) {
      setVideoError(error instanceof Error ? error.message : "Video upload failed.");
      setVideoFile(null);
    } finally {
      setVideoProgress(null);
    }
  }

  async function handleThumbnailSelect(file: File) {
    setThumbnailUploading(true);
    try {
      const response = await fetch("/api/upload-image", {
        method: "POST",
        headers: { "Content-Type": file.type, "X-Filename": file.name },
        body: file,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Thumbnail upload failed.");
      setThumbnailUrl(data.url as string);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Thumbnail upload failed.");
    } finally {
      setThumbnailUploading(false);
    }
  }

  function resetForm() {
    setVideoFile(null);
    setVideoUrl(null);
    setThumbnailUrl(null);
    setTitle("");
    setDescription("");
    setTagsInput("");
    setScheduleLater(!!initialDateStr);
    setPublishAt(initialDateStr ? `${initialDateStr}T09:00` : "");
    if (videoInputRef.current) videoInputRef.current.value = "";
    if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!videoUrl) {
      setSubmitError("Upload a video file first.");
      return;
    }
    if (!title.trim()) {
      setSubmitError("Title is required.");
      return;
    }
    if (!targetYoutube && !targetTiktok) {
      setSubmitError("Select at least one platform.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          tags: tagsInput
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          videoUrl,
          thumbnailUrl: thumbnailUrl || undefined,
          publishAt: scheduleLater && publishAt ? new Date(publishAt).toISOString() : null,

          targetYoutube,
          youtubePrivacyStatus: youtubePrivacy,
          youtubeCategoryId: youtubeCategory,
          youtubeMadeForKids,

          targetTiktok,
          tiktokPrivacyLevel: tiktokPrivacy,
          tiktokDisableComment,
          tiktokDisableDuet,
          tiktokDisableStitch,
          tiktokCoverTimestampMs: Math.round(tiktokCoverSeconds * 1000),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create upload.");

      setSubmitSuccess(scheduleLater ? "Upload scheduled." : "Upload submitted — check status on the Uploads page.");
      resetForm();
      onSuccess?.();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create upload.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        <div className={`flex items-center gap-3 ${cardClass}`}>
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-red-600 text-xs font-bold text-white">
            YT
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900">YouTube</p>
            <p className="text-xs text-slate-500">{connections?.youtube ? "Connected" : "Not connected"}</p>
          </div>
          {!connections?.youtube && (
            <a
              href="/api/auth/youtube/start"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Connect
            </a>
          )}
        </div>
        <div className={`flex items-center gap-3 ${cardClass}`}>
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white">
            TT
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900">TikTok</p>
            <p className="text-xs text-slate-500">{connections?.tiktok ? "Connected" : "Not connected"}</p>
          </div>
          {!connections?.tiktok && (
            <a
              href="/api/auth/tiktok/start"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Connect
            </a>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className={cardClass}>
          <p className={sectionLabelClass}>Video</p>
          <div className="mt-2">
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleVideoSelect(file);
              }}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
            {videoProgress !== null && (
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-blue-600 transition-all" style={{ width: `${videoProgress}%` }} />
              </div>
            )}
            {videoFile && videoUrl && <p className="mt-2 text-xs text-green-700">Uploaded: {videoFile.name}</p>}
            {videoError && <p className="mt-2 text-xs text-red-600">{videoError}</p>}
          </div>

          <p className={`${sectionLabelClass} mt-4`}>Custom thumbnail (optional)</p>
          <div className="mt-2">
            <input
              ref={thumbnailInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleThumbnailSelect(file);
              }}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
            {thumbnailUploading && <p className="mt-2 text-xs text-slate-500">Uploading…</p>}
            {thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbnailUrl} alt="Thumbnail preview" className="mt-2 h-24 w-auto rounded-md border border-slate-200" />
            )}
            <p className="mt-1 text-xs text-slate-400">
              Used as the YouTube thumbnail. TikTok uses a frame from the video itself (set below).
            </p>
          </div>
        </div>

        <div className={cardClass}>
          <p className={sectionLabelClass}>Details</p>
          <div className="mt-2 flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Video title" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Description <span className="text-slate-400">(YouTube only — TikTok uses the title as its caption)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className={inputClass}
                placeholder="What's this video about?"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Tags / hashtags <span className="text-slate-400">(comma-separated)</span>
              </label>
              <input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className={inputClass}
                placeholder="atlasnetwork, brotherhood, menshealth"
              />
            </div>
          </div>
        </div>

        <div className={cardClass}>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={targetYoutube} onChange={(e) => setTargetYoutube(e.target.checked)} />
            <span className="text-sm font-semibold text-slate-900">Post to YouTube</span>
          </label>
          {targetYoutube && (
            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Privacy</label>
                <select value={youtubePrivacy} onChange={(e) => setYoutubePrivacy(e.target.value as typeof youtubePrivacy)} className={inputClass}>
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Category</label>
                <select value={youtubeCategory} onChange={(e) => setYoutubeCategory(e.target.value)} className={inputClass}>
                  {YOUTUBE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 sm:col-span-2">
                <input type="checkbox" checked={youtubeMadeForKids} onChange={(e) => setYoutubeMadeForKids(e.target.checked)} />
                <span className="text-xs text-slate-600">Made for kids (required by YouTube)</span>
              </label>
            </div>
          )}
        </div>

        <div className={cardClass}>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={targetTiktok} onChange={(e) => setTargetTiktok(e.target.checked)} />
            <span className="text-sm font-semibold text-slate-900">Post to TikTok</span>
          </label>
          {targetTiktok && (
            <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Privacy</label>
                  <select value={tiktokPrivacy} onChange={(e) => setTiktokPrivacy(e.target.value)} className={inputClass}>
                    {TIKTOK_PRIVACY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Cover frame (seconds in)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={tiktokCoverSeconds}
                    onChange={(e) => setTiktokCoverSeconds(Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={tiktokDisableComment} onChange={(e) => setTiktokDisableComment(e.target.checked)} />
                  <span className="text-xs text-slate-600">Disable comments</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={tiktokDisableDuet} onChange={(e) => setTiktokDisableDuet(e.target.checked)} />
                  <span className="text-xs text-slate-600">Disable duet</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={tiktokDisableStitch} onChange={(e) => setTiktokDisableStitch(e.target.checked)} />
                  <span className="text-xs text-slate-600">Disable stitch</span>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className={cardClass}>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={scheduleLater} onChange={(e) => setScheduleLater(e.target.checked)} />
            <span className="text-sm font-semibold text-slate-900">Schedule for later</span>
          </label>
          {scheduleLater && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} className={inputClass} />
              <p className="mt-1 text-xs text-slate-400">
                Publishes automatically at this time — no need to come back and trigger it manually.
              </p>
            </div>
          )}
        </div>

        {submitError && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</p>}
        {submitSuccess && (
          <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{submitSuccess}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting || !videoUrl}
            className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting && <Spinner />}
            {scheduleLater ? "Schedule Upload" : "Publish Now"}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
