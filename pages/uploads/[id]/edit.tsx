import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppLayout from "../../../components/layout/AppLayout";
import Spinner from "../../../components/Spinner";
import { YOUTUBE_CATEGORIES, TIKTOK_PRIVACY_OPTIONS } from "../../../utils/uploadConstants";

interface UploadDetail {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  video_url: string;
  thumbnail_url: string | null;
  publish_at: string | null;
  published_at: string | null;

  target_youtube: boolean;
  youtube_status: string;
  youtube_privacy_status: "public" | "unlisted" | "private";
  youtube_category_id: string | null;
  youtube_made_for_kids: boolean;

  target_tiktok: boolean;
  tiktok_status: string;
  tiktok_privacy_level: string;
  tiktok_disable_comment: boolean;
  tiktok_disable_duet: boolean;
  tiktok_disable_stitch: boolean;
  tiktok_cover_timestamp_ms: number;
}

const inputClass =
  "w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const cardClass = "rounded-lg border border-slate-200 bg-white p-4";
const sectionLabelClass = "text-sm font-semibold uppercase tracking-wide text-slate-500";

// datetime-local inputs want "YYYY-MM-DDTHH:mm" in local time, not an ISO
// UTC string — this converts a stored ISO timestamp into that shape.
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditUploadPage() {
  const router = useRouter();
  const { id } = router.query;

  const [upload, setUpload] = useState<UploadDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [publishAt, setPublishAt] = useState("");

  const [youtubePrivacy, setYoutubePrivacy] = useState<"public" | "unlisted" | "private">("public");
  const [youtubeCategory, setYoutubeCategory] = useState("22");
  const [youtubeMadeForKids, setYoutubeMadeForKids] = useState(false);

  const [tiktokPrivacy, setTiktokPrivacy] = useState("PUBLIC_TO_EVERYONE");
  const [tiktokDisableComment, setTiktokDisableComment] = useState(false);
  const [tiktokDisableDuet, setTiktokDisableDuet] = useState(false);
  const [tiktokDisableStitch, setTiktokDisableStitch] = useState(false);
  const [tiktokCoverSeconds, setTiktokCoverSeconds] = useState(1);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!id || typeof id !== "string") return;
    fetch(`/api/uploads/${id}`)
      .then((res) => res.json())
      .then((data: { upload?: UploadDetail; error?: string }) => {
        if (!data.upload) {
          setLoadError(data.error ?? "Upload not found.");
          return;
        }
        const u = data.upload;
        setUpload(u);
        setTitle(u.title);
        setDescription(u.description ?? "");
        setTagsInput((u.tags ?? []).join(", "));
        setPublishAt(toLocalInputValue(u.publish_at));
        setYoutubePrivacy(u.youtube_privacy_status ?? "public");
        setYoutubeCategory(u.youtube_category_id ?? "22");
        setYoutubeMadeForKids(u.youtube_made_for_kids);
        setTiktokPrivacy(u.tiktok_privacy_level ?? "PUBLIC_TO_EVERYONE");
        setTiktokDisableComment(u.tiktok_disable_comment);
        setTiktokDisableDuet(u.tiktok_disable_duet);
        setTiktokDisableStitch(u.tiktok_disable_stitch);
        setTiktokCoverSeconds((u.tiktok_cover_timestamp_ms ?? 1000) / 1000);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load upload."));
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!upload) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const res = await fetch(`/api/uploads/${upload.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          tags: tagsInput
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          publishAt: publishAt ? new Date(publishAt).toISOString() : null,

          youtubePrivacyStatus: youtubePrivacy,
          youtubeCategoryId: youtubeCategory,
          youtubeMadeForKids,

          tiktokPrivacyLevel: tiktokPrivacy,
          tiktokDisableComment,
          tiktokDisableDuet,
          tiktokDisableStitch,
          tiktokCoverTimestampMs: Math.round(tiktokCoverSeconds * 1000),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save changes.");
      setUpload(data.upload);
      setSaveSuccess("Changes saved.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <AppLayout>
        <main className="flex-1 overflow-y-auto px-8 py-10">
          <div className="mx-auto max-w-3xl">
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>
            <Link href="/uploads" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
              Back to Uploads
            </Link>
          </div>
        </main>
      </AppLayout>
    );
  }

  if (!upload) {
    return (
      <AppLayout>
        <main className="flex flex-1 items-center justify-center">
          <Spinner />
        </main>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto max-w-3xl">
          <Link href="/uploads" className="text-sm text-blue-600 hover:underline">
            ← Back to Uploads
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Edit Scheduled Upload</h1>
          <p className="mt-1 text-sm text-slate-500">
            Changes here are saved to what will actually be posted when this publishes — this video hasn&apos;t gone
            live yet.
          </p>

          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={upload.video_url}
            poster={upload.thumbnail_url ?? undefined}
            controls
            preload="metadata"
            className="mt-4 h-56 w-full max-w-xs rounded-md border border-slate-200 bg-black object-contain"
          />

          <form onSubmit={handleSave} className="mt-6 flex flex-col gap-6">
            <div className={cardClass}>
              <p className={sectionLabelClass}>Details</p>
              <div className="mt-2 flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Title</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Description <span className="text-slate-400">(YouTube only)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Tags / hashtags <span className="text-slate-400">(comma-separated)</span>
                  </label>
                  <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Scheduled for</label>
                  <input
                    type="datetime-local"
                    value={publishAt}
                    onChange={(e) => setPublishAt(e.target.value)}
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-slate-400">Clear this to publish on the next automatic check instead.</p>
                </div>
              </div>
            </div>

            {upload.target_youtube && upload.youtube_status !== "published" && (
              <div className={cardClass}>
                <p className={sectionLabelClass}>YouTube ({upload.youtube_status})</p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Privacy</label>
                    <select
                      value={youtubePrivacy}
                      onChange={(e) => setYoutubePrivacy(e.target.value as typeof youtubePrivacy)}
                      className={inputClass}
                    >
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
              </div>
            )}

            {upload.target_tiktok && upload.tiktok_status !== "published" && (
              <div className={cardClass}>
                <p className={sectionLabelClass}>TikTok ({upload.tiktok_status})</p>
                <div className="mt-3 flex flex-col gap-3">
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
              </div>
            )}

            {saveError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</p>
            )}
            {saveSuccess && (
              <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{saveSuccess}</p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving && <Spinner />}
              Save Changes
            </button>
          </form>
        </div>
      </main>
    </AppLayout>
  );
}
