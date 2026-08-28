import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import AppLayout from "../components/layout/AppLayout";
import Spinner from "../components/Spinner";
import { YOUTUBE_CATEGORIES, TIKTOK_PRIVACY_OPTIONS } from "../utils/uploadConstants";

interface UploadRow {
  id: string;
  title: string;
  created_at: string;
  video_url: string;
  thumbnail_url: string | null;
  target_youtube: boolean;
  youtube_status: string;
  youtube_error: string | null;
  youtube_video_id: string | null;
  target_tiktok: boolean;
  tiktok_status: string;
  tiktok_error: string | null;
  publish_at: string | null;
  published_at: string | null;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Whichever platform this row targets, is it fully done publishing yet?
// Used to decide whether the card links to the edit page (still
// changeable) or is just informational (already live everywhere it
// was supposed to go).
function isFullyPublished(u: UploadRow) {
  const youtubeDone = !u.target_youtube || u.youtube_status === "published";
  const tiktokDone = !u.target_tiktok || u.tiktok_status === "published";
  return youtubeDone && tiktokDone;
}

const inputClass =
  "w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const cardClass = "rounded-lg border border-slate-200 bg-white p-4";
const sectionLabelClass = "text-sm font-semibold uppercase tracking-wide text-slate-500";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    published: "bg-green-100 text-green-700",
    publishing: "bg-blue-100 text-blue-700",
    pending: "bg-amber-100 text-amber-700",
    failed: "bg-red-100 text-red-700",
    not_connected: "bg-red-100 text-red-700",
    not_selected: "bg-slate-100 text-slate-400",
  };
  const labels: Record<string, string> = {
    published: "Published",
    publishing: "Publishing…",
    pending: "Scheduled",
    failed: "Failed",
    not_connected: "Not connected",
    not_selected: "—",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-slate-100 text-slate-500"}`}>
      {labels[status] ?? status}
    </span>
  );
}

export default function UploadsPage() {
  const router = useRouter();

  const [connections, setConnections] = useState<{ youtube: boolean; tiktok: boolean } | null>(null);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [connectionBanner, setConnectionBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  const [scheduleLater, setScheduleLater] = useState(false);
  const [publishAt, setPublishAt] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  async function loadConnections() {
    const res = await fetch("/api/platform-connections");
    if (res.ok) setConnections(await res.json());
  }

  async function loadUploads() {
    const res = await fetch("/api/uploads");
    if (res.ok) {
      const data = await res.json();
      setUploads(data.uploads ?? []);
    }
  }

  useEffect(() => {
    loadConnections();
    loadUploads();
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const { youtube_connected, youtube_error, tiktok_connected, tiktok_error } = router.query;

    if (youtube_connected) setConnectionBanner({ type: "success", text: "YouTube connected." });
    if (tiktok_connected) setConnectionBanner({ type: "success", text: "TikTok connected." });
    if (typeof youtube_error === "string") setConnectionBanner({ type: "error", text: `YouTube: ${youtube_error}` });
    if (typeof tiktok_error === "string") setConnectionBanner({ type: "error", text: `TikTok: ${tiktok_error}` });

    if (youtube_connected || youtube_error || tiktok_connected || tiktok_error) {
      loadConnections();
      router.replace("/uploads", undefined, { shallow: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

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
    setScheduleLater(false);
    setPublishAt("");
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

      setSubmitSuccess(scheduleLater ? "Upload scheduled." : "Upload submitted — check status below.");
      resetForm();
      loadUploads();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create upload.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <main className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold text-slate-900">Uploads</h1>
          <p className="mt-1 text-sm text-slate-500">
            Post a video to YouTube, TikTok, or both from one place.
          </p>

          {connectionBanner && (
            <div
              className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
                connectionBanner.type === "success"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {connectionBanner.text}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <div className={`flex items-center gap-3 ${cardClass}`}>
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-red-600 text-xs font-bold text-white">YT</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">YouTube</p>
                <p className="text-xs text-slate-500">{connections?.youtube ? "Connected" : "Not connected"}</p>
              </div>
              {!connections?.youtube && (
                <a
                  href="/api/auth/youtube/start"
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Connect
                </a>
              )}
            </div>
            <div className={`flex items-center gap-3 ${cardClass}`}>
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white">TT</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">TikTok</p>
                <p className="text-xs text-slate-500">{connections?.tiktok ? "Connected" : "Not connected"}</p>
              </div>
              {!connections?.tiktok && (
                <a
                  href="/api/auth/tiktok/start"
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Connect
                </a>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
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
                {videoFile && videoUrl && (
                  <p className="mt-2 text-xs text-green-700">Uploaded: {videoFile.name}</p>
                )}
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
                  <input
                    type="datetime-local"
                    value={publishAt}
                    onChange={(e) => setPublishAt(e.target.value)}
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Publishes automatically at this time — no need to come back and trigger it manually.
                  </p>
                </div>
              )}
            </div>

            {submitError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</p>
            )}
            {submitSuccess && (
              <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{submitSuccess}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !videoUrl}
              className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submitting && <Spinner />}
              {scheduleLater ? "Schedule Upload" : "Publish Now"}
            </button>
          </form>

          <div className="mt-10">
            <p className={sectionLabelClass}>Recent uploads</p>
            {uploads.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No uploads yet.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-3">
                {uploads.map((u) => {
                  const editable = !isFullyPublished(u);
                  const dateLine = u.published_at
                    ? `Published: ${formatDateTime(u.published_at)}`
                    : u.publish_at
                      ? `Scheduled: ${formatDateTime(u.publish_at)}`
                      : `Uploaded: ${formatDateTime(u.created_at)}`;

                  const content = (
                    <>
                      <div className="h-20 w-32 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                        {u.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.thumbnail_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          // First frame of the video itself, since no custom
                          // thumbnail was set — browsers render this as a
                          // static image once metadata loads.
                          // eslint-disable-next-line jsx-a11y/media-has-caption
                          <video src={u.video_url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{u.title}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{dateLine}</p>
                        {u.youtube_error && <p className="mt-1 text-xs text-red-600">YouTube: {u.youtube_error}</p>}
                        {u.tiktok_error && <p className="mt-1 text-xs text-red-600">TikTok: {u.tiktok_error}</p>}
                        {editable && <p className="mt-1 text-xs font-medium text-blue-600">Click to edit</p>}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {u.target_youtube && <StatusBadge status={u.youtube_status} />}
                        {u.target_tiktok && <StatusBadge status={u.tiktok_status} />}
                      </div>
                    </>
                  );

                  return (
                    <li key={u.id}>
                      {editable ? (
                        <Link
                          href={`/uploads/${u.id}/edit`}
                          className={`${cardClass} flex items-center gap-3 transition-colors hover:border-blue-300 hover:bg-blue-50/40`}
                        >
                          {content}
                        </Link>
                      ) : (
                        <div className={`${cardClass} flex items-center gap-3`}>{content}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
