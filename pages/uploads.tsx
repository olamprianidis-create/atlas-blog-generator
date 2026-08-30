import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppLayout from "../components/layout/AppLayout";
import UploadForm from "../components/UploadForm";

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

  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [connectionBanner, setConnectionBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadUploads() {
    const res = await fetch("/api/uploads");
    if (res.ok) {
      const data = await res.json();
      setUploads(data.uploads ?? []);
    }
  }

  useEffect(() => {
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
      router.replace("/uploads", undefined, { shallow: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

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

          <div className="mt-6">
            <UploadForm onSuccess={loadUploads} />
          </div>

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

                  return (
                    <li key={u.id} className={`${cardClass} flex items-center gap-3`}>
                      {/* Real playable video with native controls — kept
                          outside the edit Link below, since a <video>
                          nested inside an <a> swallows clicks meant for
                          the link (this was silently breaking both
                          "watch the video" and "click to edit" before). */}
                      <div className="h-24 w-40 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-black">
                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                        <video
                          src={u.video_url}
                          poster={u.thumbnail_url ?? undefined}
                          controls
                          preload="metadata"
                          className="h-full w-full object-contain"
                        />
                      </div>

                      {editable ? (
                        <Link
                          href={`/uploads/${u.id}/edit`}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-md transition-colors hover:bg-blue-50/40"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900">{u.title}</p>
                            <p className="mt-0.5 text-xs text-slate-400">{dateLine}</p>
                            {u.youtube_error && <p className="mt-1 text-xs text-red-600">YouTube: {u.youtube_error}</p>}
                            {u.tiktok_error && <p className="mt-1 text-xs text-red-600">TikTok: {u.tiktok_error}</p>}
                            <p className="mt-1 text-xs font-medium text-blue-600">Click to edit</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            {u.target_youtube && <StatusBadge status={u.youtube_status} />}
                            {u.target_tiktok && <StatusBadge status={u.tiktok_status} />}
                          </div>
                        </Link>
                      ) : (
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900">{u.title}</p>
                            <p className="mt-0.5 text-xs text-slate-400">{dateLine}</p>
                            {u.youtube_error && <p className="mt-1 text-xs text-red-600">YouTube: {u.youtube_error}</p>}
                            {u.tiktok_error && <p className="mt-1 text-xs text-red-600">TikTok: {u.tiktok_error}</p>}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            {u.target_youtube && <StatusBadge status={u.youtube_status} />}
                            {u.target_tiktok && <StatusBadge status={u.tiktok_status} />}
                          </div>
                        </div>
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
