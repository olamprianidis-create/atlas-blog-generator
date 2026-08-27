import { useEffect, useMemo, useState } from "react";
import AppLayout from "../components/layout/AppLayout";
import CalendarDayModal, { CalendarEventItem, ScheduledArticleForDay } from "../components/CalendarDayModal";
import { BLOG_POST_COLOR_CLASS, PLATFORMS } from "../utils/types";

const CHECKED_COLOR = "#5f7644";
const PAST_UNCHECKED_COLOR = "#f2730b";
const WEEKDAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const MAX_VISIBLE_CHIPS = 2;

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

const PUBLISHED_BLOG_POST_COLOR_CLASS = "bg-green-700";

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

function getMonthGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = (firstDay.getDay() + 6) % 7; // 0 = Monday

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export default function CalendarPage() {
  const today = todayDateStr();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1); // 1-12

  const [checkedDays, setCheckedDays] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [scheduledArticles, setScheduledArticles] = useState<ScheduledArticleRow[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const grid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const monthLabel = useMemo(
    () =>
      new Date(viewYear, viewMonth - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    [viewYear, viewMonth]
  );

  useEffect(() => {
    fetch(`/api/calendar/days?year=${viewYear}&month=${viewMonth}`)
      .then((res) => res.json())
      .then((days: string[]) => setCheckedDays(new Set(days)))
      .catch((err) => console.error("Failed to load calendar days:", err));

    fetch(`/api/calendar/events?year=${viewYear}&month=${viewMonth}`)
      .then((res) => res.json())
      .then((data: CalendarEventItem[]) => setEvents(data))
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
  }, []);

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

  async function toggleDay(dateStr: string, checked: boolean) {
    setCheckedDays((current) => {
      const next = new Set(current);
      if (checked) next.add(dateStr);
      else next.delete(dateStr);
      return next;
    });

    try {
      const response = await fetch("/api/calendar/days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day: dateStr, checked }),
      });
      if (!response.ok) throw new Error("Failed to save");
    } catch (err) {
      console.error("Failed to update calendar day:", err);
      // Revert optimistic update on failure.
      setCheckedDays((current) => {
        const next = new Set(current);
        if (checked) next.delete(dateStr);
        else next.add(dateStr);
        return next;
      });
    }
  }

  function findArticleForDate(dateStr: string): ScheduledArticleForDay | null {
    const match = scheduledArticles.find(
      (article) => article.publish_date && article.publish_date.slice(0, 10) === dateStr
    );
    return match
      ? { id: match.id, title: match.title, image_url: match.image_url, status: match.status }
      : null;
  }

  function eventsForDate(dateStr: string) {
    return events.filter((event) => event.event_date === dateStr);
  }

  function getChipsForDate(dateStr: string): { key: string; label: string; colorClass: string }[] {
    const chips: { key: string; label: string; colorClass: string }[] = [];

    const article = findArticleForDate(dateStr);
    if (article) {
      chips.push({
        key: `article-${article.id}`,
        label: article.title,
        colorClass: article.status === "published" ? PUBLISHED_BLOG_POST_COLOR_CLASS : BLOG_POST_COLOR_CLASS,
      });
    }

    for (const event of eventsForDate(dateStr)) {
      if (event.platforms.length === 0) {
        chips.push({
          key: `event-${event.id}`,
          label: event.description || "Event",
          colorClass: "bg-slate-400",
        });
        continue;
      }
      for (const platform of event.platforms) {
        chips.push({
          key: `event-${event.id}-${platform}`,
          label: event.description || platformLabel(platform),
          colorClass: platformColorClass(platform),
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
                  {row.map((day, colIndex) => {
                    if (day === null) {
                      return (
                        <div
                          key={colIndex}
                          className="min-h-[104px] border-r border-slate-100 bg-slate-50 last:border-r-0"
                        />
                      );
                    }

                    const dateStr = toDateStr(viewYear, viewMonth, day);
                    const isChecked = checkedDays.has(dateStr);
                    const isPast = dateStr < today;
                    const isTodayCell = dateStr === today;
                    const chips = getChipsForDate(dateStr);
                    const visibleChips = chips.slice(0, MAX_VISIBLE_CHIPS);
                    const overflowCount = chips.length - visibleChips.length;

                    const cellStyle = isChecked
                      ? { backgroundColor: CHECKED_COLOR }
                      : isPast
                        ? { backgroundColor: PAST_UNCHECKED_COLOR }
                        : undefined;
                    const textTone = isChecked || isPast ? "text-white" : "text-slate-900";

                    return (
                      <button
                        key={colIndex}
                        type="button"
                        onClick={() => setSelectedDate(dateStr)}
                        style={cellStyle}
                        className={`relative flex min-h-[104px] flex-col gap-1 border-r border-slate-100 p-2 pb-7 text-left transition-colors last:border-r-0 hover:brightness-95 ${
                          cellStyle ? "" : "bg-white"
                        }`}
                      >
                        <span
                          className={`shrink-0 text-sm font-semibold ${textTone} ${isTodayCell && !cellStyle ? "w-fit rounded-full bg-blue-600 px-1.5 py-0.5 text-white" : ""}`}
                        >
                          {day}
                        </span>

                        <div className="flex min-w-0 flex-col gap-1">
                          {visibleChips.map((chip) => (
                            <span
                              key={chip.key}
                              className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight text-white ${chip.colorClass} ${
                                cellStyle ? "ring-1 ring-white/40" : ""
                              }`}
                            >
                              {chip.label}
                            </span>
                          ))}
                          {overflowCount > 0 && (
                            <span className={`text-[10px] font-medium ${textTone}`}>+{overflowCount} more</span>
                          )}
                        </div>

                        <span
                          role="checkbox"
                          aria-checked={isChecked}
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            void toggleDay(dateStr, !isChecked);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              event.stopPropagation();
                              void toggleDay(dateStr, !isChecked);
                            }
                          }}
                          className={`absolute bottom-2 right-2 flex h-5 w-5 cursor-pointer items-center justify-center rounded border ${
                            cellStyle ? "border-white/70" : "border-slate-300"
                          }`}
                        >
                          {isChecked && (
                            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
                              <path
                                d="m5 13 4 4 10-10"
                                stroke="white"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded" style={{ backgroundColor: CHECKED_COLOR }} />
              Checked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded" style={{ backgroundColor: PAST_UNCHECKED_COLOR }} />
              Missed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-slate-300 bg-white" />
              Upcoming
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded ${BLOG_POST_COLOR_CLASS}`} />
              Blog post (scheduled)
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded ${PUBLISHED_BLOG_POST_COLOR_CLASS}`} />
              Blog post (published)
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
          scheduledArticle={findArticleForDate(selectedDate)}
          events={eventsForDate(selectedDate)}
          onClose={() => setSelectedDate(null)}
          onEventCreated={(event) => setEvents((current) => [...current, event])}
          onEventUpdated={(event) =>
            setEvents((current) => current.map((e) => (e.id === event.id ? event : e)))
          }
          onEventDeleted={(eventId) => setEvents((current) => current.filter((e) => e.id !== eventId))}
        />
      )}
    </AppLayout>
  );
}
