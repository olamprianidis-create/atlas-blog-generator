export interface TimezoneOption {
  value: string;
  label: string;
  // IANA zone — handles daylight saving automatically, so "9:00 AM Pacific"
  // means 9:00 PDT in summer and 9:00 PST in winter. (Before 2026-10-05
  // these were fixed UTC offsets, which put every summer publish an hour
  // late.) `value` keeps the old short codes so saved drafts still load.
  zone: string;
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: "PST", label: "Pacific Time (PT)", zone: "America/Los_Angeles" },
  { value: "MST", label: "Mountain Time (MT)", zone: "America/Denver" },
  { value: "CST", label: "Central Time (CT)", zone: "America/Chicago" },
  { value: "EST", label: "Eastern Time (ET)", zone: "America/New_York" },
  { value: "UTC", label: "UTC", zone: "UTC" },
];

export const DEFAULT_TIMEZONE = "PST";

function getZone(timezoneValue: string): string {
  return TIMEZONE_OPTIONS.find((t) => t.value === timezoneValue)?.zone ?? "America/Los_Angeles";
}

// The wall-clock date/time an instant shows in `zone`.
function wallClockParts(instant: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

// Minutes `zone` is ahead of UTC at `instant` (e.g. -420 for PDT).
function zoneOffsetMinutes(instant: Date, zone: string): number {
  const p = wallClockParts(instant, zone);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((wallAsUtc - Math.floor(instant.getTime() / 60000) * 60000) / 60000);
}

export function buildPublishDate(date: string, time: string, timezoneValue: string): Date {
  const zone = getZone(timezoneValue);
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, hh, mm);
  // Guess with the offset at that moment, then correct once in case the
  // guess landed on the other side of a daylight-saving switch.
  let instant = wallAsUtc - zoneOffsetMinutes(new Date(wallAsUtc), zone) * 60000;
  const corrected = wallAsUtc - zoneOffsetMinutes(new Date(instant), zone) * 60000;
  if (corrected !== instant) instant = corrected;
  return new Date(instant);
}

// Inverse of buildPublishDate — given an ISO instant and a timezone,
// recovers the date/time strings a user would have typed to produce that
// instant. Used to pre-fill the schedule form when editing an
// already-scheduled article.
export function parsePublishDate(iso: string, timezoneValue: string): { date: string; time: string } {
  const p = wallClockParts(new Date(iso), getZone(timezoneValue));
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

export function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export function formatTimeLabel(timeStr: string): string {
  const [h, min] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(min)) return timeStr;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(min).padStart(2, "0")} ${period}`;
}

// e.g. "October 14, 2026 at 9:00 AM PDT" — the abbreviation reflects
// whether daylight saving is in effect on that date.
export function formatPublishPreview(date: string, time: string, timezoneValue: string): string {
  if (!date || !time) return "";
  const zone = getZone(timezoneValue);
  const abbreviation =
    new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" })
      .formatToParts(buildPublishDate(date, time, timezoneValue))
      .find((p) => p.type === "timeZoneName")?.value ?? timezoneValue;
  return `${formatDateLabel(date)} at ${formatTimeLabel(time)} ${abbreviation}`;
}
