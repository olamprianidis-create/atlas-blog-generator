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
