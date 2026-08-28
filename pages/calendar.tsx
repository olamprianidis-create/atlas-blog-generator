import { useEffect, useMemo, useState } from "react";
import AppLayout from "../components/layout/AppLayout";
import CalendarDayModal, {
  CalendarEventItem,
  ScheduledArticleForDay,
  VideoUploadForDay,
} from "../components/CalendarDayModal";
import { BLOG_POST_COLOR_CLASS, PLATFORMS } from "../utils/types";

const WEEKDAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
// Used for a platform-less event's single checkbox (no real platform tag).
const GENERAL_PLATFORM_KEY = "general";

function platformColorClass(value: string) {
  return PLATFORMS.find((p) => p.value === value)?.colorClass ?? "bg-slate-400";
}

function platformLabel(value: string) {
  return PLATFORMS.find((p) => p.value === value)?.label ?? value;
}

interface ScheduledArticleRow {
  id: string;
  title: string;
  publish_date: string | null;
  image_url: string | null;
  status: "scheduled" | "published";
}

interface VideoUploadRow {
  id: string;
  title: string;
  publish_at: string | null;
  published_at: string | null;
  created_at: string;
  target_youtube: boolean;
  youtube_status: string;
  youtube_video_id: string | null;
  target_tiktok: boolean;
  tiktok_status: string;
  tiktok_publish_id: string | null;
}

// One video_uploads row can target multiple platforms (YouTube + TikTok),
// each with its own independent status — this flattens a row into one
// entry per targeted-and-attempted platform, so a single video shows as
// two separate calendar chips/entries (one per platform) instead of one
// combined blob, per the explicit "video one on YouTube and video one on
// TikTok should be two events" requirement.
interface VideoPlatformEntry {
  key: string;
  uploadId: string;
  platform: "youtube" | "tiktok";
  title: string;
  status: string;
  dateStr: string | null;
  externalId: string | null;
}

function flattenVideoUploads(uploads: VideoUploadRow[]): VideoPlatformEntry[] {
  const entries: VideoPlatformEntry[] = [];
  for (const upload of uploads) {
    if (upload.target_youtube && upload.youtube_status !== "not_selected") {
      const isoDate = upload.published_at ?? upload.publish_at ?? upload.created_at;
      entries.push({
        key: `upload-${upload.id}-youtube`,
        uploadId: upload.id,
        platform: "youtube",
        title: upload.title,
        status: upload.youtube_status,
        dateStr: isoDate.slice(0, 10),
        externalId: upload.youtube_video_id,
      });
    }
    if (upload.target_tiktok && upload.tiktok_status !== "not_selected") {
      const isoDate = upload.published_at ?? upload.publish_at ?? upload.created_at;
      entries.push({
        key: `upload-${upload.id}-tiktok`,
        uploadId: upload.id,
        platform: "tiktok",
        title: upload.title,
        status: upload.tiktok_status,
        dateStr: isoDate.slice(0, 10),
        externalId: upload.tiktok_publish_id,
      });
    }
  }
  return entries;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function todayDateStr() {
  const now = new Date();
  return toDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

interface DayCell {
  day: number;
  year: number;
  month: number; // 1-12
  isCurrentMonth: boolean;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

// Always fills every cell with a real date — leading/trailing cells that
// belong to the previous/next month (e.g. the month starts on a Saturday)
// show that month's actual day number instead of a blank box, matching
// how Google/Apple Calendar render a month grid.
function getMonthGrid(year: number, month: number): DayCell[][] {
  const firstDay = new Date(year, month - 1, 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7; // 0 = Monday
  const totalDaysInMonth = daysInMonth(year, month);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const totalDaysInPrevMonth = daysInMonth(prevYear, prevMonth);

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const cells: DayCell[] = [];
  for (let i = firstWeekday; i > 0; i--) {
    cells.push({ day: totalDaysInPrevMonth - i + 1, year: prevYear, month: prevMonth, isCurrentMonth: false });
  }
  for (let d = 1; d <= totalDaysInMonth; d++) {
    cells.push({ day: d, year, month, isCurrentMonth: true });
  }
  for (let d = 1; cells.length % 7 !== 0; d++) {
    cells.push({ day: d, year: nextYear, month: nextMonth, isCurrentMonth: false });
  }

  const rows: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export default function CalendarPage() {
  const today = todayDateStr();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1); // 1-12

  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [scheduledArticles, setScheduledArticles] = useState<ScheduledArticleRow[]>([]);
  const [videoUploads, setVideoUploads] = useState<VideoUploadRow[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const grid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const monthLabel = useMemo(
    () =>
      new Date(viewYear, viewMonth - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    [viewYear, viewMonth]
  );

  useEffect(() => {
    // The grid always shows full weeks, so it leaks a few days from the
    // previous/next month at the edges — fetch those two months as well
    // (not just the viewed one) so those leaking days' event state is
    // accurate instead of always appearing empty.
    const prevMonth = viewMonth === 1 ? 12 : viewMonth - 1;
    const prevYear = viewMonth === 1 ? viewYear - 1 : viewYear;
    const nextMonth = viewMonth === 12 ? 1 : viewMonth + 1;
    const nextYear = viewMonth === 12 ? viewYear + 1 : viewYear;
    const months = [
      [viewYear, viewMonth],
      [prevYear, prevMonth],
      [nextYear, nextMonth],
    ];

    Promise.all(
      months.map(([y, m]) => fetch(`/api/calendar/events?year=${y}&month=${m}`).then((res) => res.json()))
    )
      .then((results: CalendarEventItem[][]) => setEvents(results.flat()))
      .catch((err) => console.error("Failed to load calendar events:", err));
  }, [viewYear, viewMonth]);

  useEffect(() => {
    // The calendar shows blog posts across their whole lifecycle — once a
    // post actually publishes it used to disappear from here entirely,
    // since /api/scheduled-articles only ever returns status="scheduled"
    // rows (by design — that endpoint also backs the Scheduled page,
    // which shouldn't show already-published articles). So the calendar
    // merges that with /api/published-articles instead of widening the
    // shared endpoint's filter.
    Promise.all([
      fetch("/api/scheduled-articles").then((res) => res.json()),
      fetch("/api/published-articles").then((res) => res.json()),
    ])
      .then(([scheduled, published]: [ScheduledArticleRow[], ScheduledArticleRow[]]) => {
        const scheduledRows = scheduled.map((row) => ({ ...row, status: "scheduled" as const }));
        const publishedRows = published.map((row) => ({ ...row, status: "published" as const }));
        setScheduledArticles([...scheduledRows, ...publishedRows]);
      })
      .catch((err) => console.error("Failed to load blog posts for calendar:", err));

    fetch("/api/uploads")
      .then((res) => res.json())
      .then((data: { uploads: VideoUploadRow[] }) => setVideoUploads(data.uploads ?? []))
      .catch((err) => console.error("Failed to load video uploads for calendar:", err));
  }, []);

  const videoPlatformEntries = useMemo(() => flattenVideoUploads(videoUploads), [videoUploads]);

  function goToPrevMonth() {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function setEventPlatformCompleted(eventId: string, platform: string, completed: boolean) {
    setEvents((current) =>
      current.map((e) => {
        if (e.id !== eventId) return e;
        const existing = e.completed_platforms ?? [];
        const next = completed
          ? Array.from(new Set([...existing, platform]))
          : existing.filter((p) => p !== platform);
        return { ...e, completed_platforms: next };
      })
    );
  }

  // Manual platform events (Instagram/Pinterest/etc.) have no automated
  // publish pipeline the way blog articles and YouTube/TikTok uploads do
  // — there's no way to know automatically whether you actually posted,
  // so these checkboxes stay manually toggled. Each targeted platform on
  // an event gets its own independent checkbox (completed_platforms),
  // not one shared checkbox for the whole event.
  async function toggleEventPlatform(eventId: string, platform: string, completed: boolean) {
    setEventPlatformCompleted(eventId, platform, completed);
    try {
      const res = await fetch(`/api/calendar/events/${eventId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, completed }),
      });
      if (!res.ok) throw new Error("Failed to save");
    } catch (err) {
      console.error("Failed to toggle event completion:", err);
      setEventPlatformCompleted(eventId, platform, !completed);
    }
  }

  function findArticlesForDate(dateStr: string): ScheduledArticleForDay[] {
    return scheduledArticles
      .filter((article) => article.publish_date && article.publish_date.slice(0, 10) === dateStr)
      .map((article) => ({
        id: article.id,
        title: article.title,
        image_url: article.image_url,
        status: article.status,
      }));
  }

  function eventsForDate(dateStr: string) {
    return events.filter((event) => event.event_date === dateStr);
  }

  function videosForDate(dateStr: string) {
    return videoPlatformEntries.filter((entry) => entry.dateStr === dateStr);
  }

  interface Chip {
    key: string;
    label: string;
    colorClass: string;
    checked: boolean;
    // Undefined = auto-tracked from real publish status (blog articles,
    // YouTube/TikTok uploads) — shown as a checkbox but not clickable,
    // since it should only ever reflect what actually happened. Present =
    // manually toggleable (platform events with no automated pipeline).
    onToggle?: () => void;
  }

  function getChipsForDate(dateStr: string): Chip[] {
    const chips: Chip[] = [];

    for (const article of findArticlesForDate(dateStr)) {
      chips.push({
        key: `article-${article.id}`,
        label: article.title,
        colorClass: BLOG_POST_COLOR_CLASS,
        checked: article.status === "published",
      });
    }

    // Each targeted platform on a video_uploads row gets its own chip —
    // a Short posted to both YouTube and TikTok shows as two separate
    // entries on the same day, not one combined blob.
    for (const video of videosForDate(dateStr)) {
      chips.push({
        key: video.key,
        label: `${video.title} (${platformLabel(video.platform)})`,
        colorClass: platformColorClass(video.platform),
        checked: video.status === "published",
      });
    }

    for (const event of eventsForDate(dateStr)) {
      const completed = event.completed_platforms ?? [];
      if (event.platforms.length === 0) {
        chips.push({
          key: `event-${event.id}-${GENERAL_PLATFORM_KEY}`,
          label: event.description || "Event",
          colorClass: "bg-slate-400",
          checked: completed.includes(GENERAL_PLATFORM_KEY),
          onToggle: () =>
            toggleEventPlatform(event.id, GENERAL_PLATFORM_KEY, !completed.includes(GENERAL_PLATFORM_KEY)),
        });
        continue;
      }
      for (const platform of event.platforms) {
        chips.push({
          key: `event-${event.id}-${platform}`,
          label: event.description || platformLabel(platform),
          colorClass: platformColorClass(platform),
          checked: completed.includes(platform),
          onToggle: () => toggleEventPlatform(event.id, platform, !completed.includes(platform)),
        });
      }
    }

    return chips;
  }

  return (
    <AppLayout>
      <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-slate-900">Content Calendar</h1>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={goToPrevMonth}
                aria-label="Previous month"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              >
                ‹
              </button>
              <p className="w-36 text-center text-sm font-medium text-slate-900">{monthLabel}</p>
              <button
                type="button"
                onClick={goToNextMonth}
                aria-label="Next month"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              >
                ›
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-7 border-b border-slate-900 bg-slate-900">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className="px-3 py-2 text-center text-xs font-bold tracking-wide text-white">
                    {label}
                  </div>
                ))}
              </div>

              {grid.map((row, rowIndex) => (
                <div key={rowIndex} className="grid grid-cols-7 border-b border-slate-200 last:border-b-0">
                  {row.map((cell, colIndex) => {
                    const dateStr = toDateStr(cell.year, cell.month, cell.day);
                    const isTodayCell = dateStr === today;
                    const chips = getChipsForDate(dateStr);
                    const dimmed = !cell.isCurrentMonth;

                    return (
                      // A plain div (not a <button>) — chips below render
                      // their own clickable checkboxes, and nesting
                      // interactive controls inside a <button> is invalid
                      // HTML that silently breaks click handling (the
                      // same issue that made the Uploads page's video
                      // preview swallow clicks earlier).
                      <div
                        key={colIndex}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedDate(dateStr)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedDate(dateStr);
                          }
                        }}
                        className={`flex h-56 cursor-pointer flex-col gap-1 overflow-hidden border-r border-slate-100 p-2 text-left transition-colors last:border-r-0 hover:brightness-95 ${
                          dimmed ? "bg-slate-50" : "bg-white"
                        }`}
                      >
                        <span
                          className={`shrink-0 text-sm font-semibold ${dimmed ? "text-slate-400" : "text-slate-900"} ${isTodayCell ? "w-fit rounded-full bg-blue-600 px-1.5 py-0.5 text-white" : ""}`}
                        >
                          {cell.day}
                        </span>

                        <div className="flex min-w-0 flex-1 flex-col gap-1 overflow-y-auto">
                          {chips.map((chip) => (
                            <div
                              key={chip.key}
                              className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium leading-tight text-white ${chip.colorClass} ${
                                dimmed ? "opacity-60" : ""
                              }`}
                            >
                              <button
                                type="button"
                                aria-label={chip.checked ? "Mark as not done" : "Mark as done"}
                                aria-checked={chip.checked}
                                role="checkbox"
                                disabled={!chip.onToggle}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  chip.onToggle?.();
                                }}
                                className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border border-white/70 bg-white/10 ${
                                  chip.onToggle ? "cursor-pointer hover:bg-white/30" : "cursor-default"
                                }`}
                              >
                                {chip.checked && (
                                  <svg viewBox="0 0 24 24" fill="none" className="h-2.5 w-2.5">
                                    <path
                                      d="m5 13 4 4 10-10"
                                      stroke="white"
                                      strokeWidth="3"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                )}
                              </button>
                              <span className="truncate">{chip.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded ${BLOG_POST_COLOR_CLASS}`} />
              Blog
            </span>
            {PLATFORMS.map((platform) => (
              <span key={platform.value} className="flex items-center gap-1.5">
                <span className={`h-3 w-3 rounded ${platform.colorClass}`} />
                {platform.label}
              </span>
            ))}
          </div>
        </div>
      </main>

      {selectedDate && (
        <CalendarDayModal
          dateStr={selectedDate}
          scheduledArticles={findArticlesForDate(selectedDate)}
          videoUploads={videosForDate(selectedDate)}
          events={eventsForDate(selectedDate)}
          onClose={() => setSelectedDate(null)}
          onEventCreated={(event) => setEvents((current) => [...current, event])}
          onEventUpdated={(event) =>
            setEvents((current) => current.map((e) => (e.id === event.id ? event : e)))
          }
          onEventDeleted={(eventId) => setEvents((current) => current.filter((e) => e.id !== eventId))}
          onArticleDeleted={(articleId) =>
            setScheduledArticles((current) => current.filter((a) => a.id !== articleId))
          }
          onVideoDeleted={(uploadId) => setVideoUploads((current) => current.filter((u) => u.id !== uploadId))}
        />
      )}
    </AppLayout>
  );
}
