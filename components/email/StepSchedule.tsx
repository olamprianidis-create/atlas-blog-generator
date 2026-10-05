import { TIMEZONE_OPTIONS, buildPublishDate, formatPublishPreview } from "../../utils/timezones";

export interface ScheduleValue {
  send_immediately: boolean;
  send_date: string | null;
  send_time: string | null;
  timezone: string;
}

function formatIn(instant: Date, zone: string, label: string) {
  return `${instant.toLocaleString("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" })} ${label}`;
}

export default function StepSchedule({ value, onChange }: { value: ScheduleValue; onChange: (next: ScheduleValue) => void }) {
  const instant =
    value.send_date && value.send_time ? buildPublishDate(value.send_date, value.send_time, value.timezone) : null;
  const isPast = instant !== null && instant.getTime() <= Date.now();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">When should it go out?</h2>
        <p className="mt-1 text-sm text-slate-500">Daylight saving is handled automatically.</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {[
          { immediate: false, title: "Schedule for later", detail: "Pick a date, time and time zone" },
          { immediate: true, title: "Send immediately", detail: "Goes out as soon as you confirm" },
        ].map((option) => (
          <button
            key={option.title}
            type="button"
            onClick={() => onChange({ ...value, send_immediately: option.immediate })}
            className={`rounded-lg border px-4 py-3 text-left transition-colors ${
              value.send_immediately === option.immediate
                ? "border-slate-900 bg-slate-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <p className="text-sm font-semibold text-slate-900">{option.title}</p>
            <p className="text-xs text-slate-500">{option.detail}</p>
          </button>
        ))}
      </div>

      {!value.send_immediately && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Time zone</span>
              <select
                value={value.timezone}
                onChange={(e) => onChange({ ...value, timezone: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Time of day</span>
              <input
                type="time"
                value={value.send_time ?? ""}
                onChange={(e) => onChange({ ...value, send_time: e.target.value || null })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Date</span>
              <input
                type="date"
                value={value.send_date ?? ""}
                onChange={(e) => onChange({ ...value, send_date: e.target.value || null })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          {instant && (
            <div className={`rounded-xl px-5 py-4 ${isPast ? "bg-red-50 text-red-800" : "bg-slate-900 text-white"}`}>
              <p className="text-base font-semibold">
                {isPast ? "That time has already passed" : `Sends ${formatPublishPreview(value.send_date!, value.send_time!, value.timezone)}`}
              </p>
              {!isPast && (
                <p className="mt-1 text-xs text-slate-300">
                  {formatIn(instant, "America/Los_Angeles", "Pacific")} · {formatIn(instant, "America/New_York", "Eastern")}
                  {" · "}may arrive up to ~10 minutes after this time
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
