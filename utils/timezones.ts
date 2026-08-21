export interface TimezoneOption {
  value: string;
  label: string;
  offset: string;
}

// Fixed UTC offsets for simplicity — doesn't auto-adjust for DST
// transitions the way a full IANA-timezone library would.
export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: "EST", label: "Eastern Time (EST)", offset: "-05:00" },
  { value: "CST", label: "Central Time (CST)", offset: "-06:00" },
  { value: "MST", label: "Mountain Time (MST)", offset: "-07:00" },
  { value: "PST", label: "Pacific Time (PST)", offset: "-08:00" },
  { value: "UTC", label: "UTC", offset: "+00:00" },
];

export const DEFAULT_TIMEZONE = "EST";

function getOffset(timezoneValue: string): string {
  return TIMEZONE_OPTIONS.find((t) => t.value === timezoneValue)?.offset ?? "-05:00";
}

export function buildPublishDate(date: string, time: string, timezoneValue: string): Date {
  return new Date(`${date}T${time}:00${getOffset(timezoneValue)}`);
}

// Inverse of buildPublishDate — given an ISO instant and a fixed-offset
// timezone, recovers the date/time strings a user would have typed to
// produce that instant. Used to pre-fill the schedule form when editing
// an already-scheduled article.
export function parsePublishDate(iso: string, timezoneValue: string): { date: string; time: string } {
  const offset = getOffset(timezoneValue);
  const sign = offset.startsWith("-") ? -1 : 1;
  const [offsetHours, offsetMinutes] = offset.slice(1).split(":").map(Number);
  const offsetTotalMinutes = sign * (offsetHours * 60 + offsetMinutes);

  const shifted = new Date(new Date(iso).getTime() + offsetTotalMinutes * 60000);

  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");

  return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
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

export function formatPublishPreview(date: string, time: string, timezoneValue: string): string {
  if (!date || !time) return "";
  return `${formatDateLabel(date)} at ${formatTimeLabel(time)} ${timezoneValue}`;
}
