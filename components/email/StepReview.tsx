import { useEffect, useState } from "react";
import { AudienceOptions, AudienceStats, EmailCampaign, SenderSettings, campaignProblems } from "../../utils/emailCampaigns";
import { formatPublishPreview } from "../../utils/timezones";
import { EmailPreview, InboxPreview } from "./EmailPreviews";

function Row({ label, children, onEdit }: { label: string; children: React.ReactNode; onEdit?: () => void }) {
  return (
    <div className="flex gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <p className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="min-w-0 flex-1 text-sm text-slate-900">{children}</div>
      {onEdit && (
        <button type="button" onClick={onEdit} className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-900">
          Edit
        </button>
      )}
    </div>
  );
}

// Sends the saved campaign to one address with "[Test]" on the subject.
function TestSend({ campaignId, defaultTo }: { campaignId: string; defaultTo: string }) {
  const [to, setTo] = useState(defaultTo);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setState("sending");
    setError(null);
    try {
      const response = await fetch(`/api/email/campaigns/${campaignId}/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Test send failed");
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test send failed");
      setState("idle");
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Send me a test</p>
      <p className="mt-0.5 text-xs text-slate-500">Arrives with “[Test]” in the subject. Nobody else gets it.</p>
      <div className="mt-3 flex gap-2">
        <input
          type="email"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setState("idle");
          }}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
        <button
          type="button"
          onClick={send}
          disabled={state === "sending" || !to.trim()}
          className="shrink-0 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-40"
        >
          {state === "sending" ? "Sending…" : state === "sent" ? "Sent ✓" : "Send test"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default function StepReview({
  campaign,
  sender,
  onGoToStep,
  onConfirm,
  isConfirming,
}: {
  campaign: EmailCampaign;
  sender: SenderSettings;
  onGoToStep: (step: number) => void;
  onConfirm: (recipients: number, whenLabel: string) => void;
  isConfirming: boolean;
}) {
  const [stats, setStats] = useState<AudienceStats | null>(null);
  const [options, setOptions] = useState<AudienceOptions | null>(null);
  const isDraft = campaign.status === "draft";
  const problems = isDraft ? campaignProblems(campaign) : [];

  useEffect(() => {
    fetch("/api/email/audience")
      .then((r) => r.json())
      .then((data) => setOptions(data as AudienceOptions))
      .catch(() => undefined);
    fetch("/api/email/audience", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audience_list_ids: campaign.audience_list_ids,
        audience_contact_ids: campaign.audience_contact_ids,
        include_all_members: campaign.include_all_members,
        include_all_contacts: campaign.include_all_contacts,
      }),
    })
      .then((r) => r.json())
      .then((data) => setStats(data as AudienceStats))
      .catch(() => undefined);
  }, [campaign.audience_list_ids, campaign.audience_contact_ids, campaign.include_all_members, campaign.include_all_contacts]);

  const audienceNames = [
    campaign.include_all_members && "All ATLAS Members",
    campaign.include_all_contacts && "All Contacts",
    ...(campaign.include_all_contacts
      ? []
      : campaign.audience_list_ids.map((id) => options?.lists.find((l) => l.id === id)?.name ?? "List")),
    !campaign.include_all_contacts &&
      campaign.audience_contact_ids.length > 0 &&
      `${campaign.audience_contact_ids.length} specific ${campaign.audience_contact_ids.length === 1 ? "person" : "people"}`,
  ].filter(Boolean);

  const whenLabel = campaign.send_immediately
    ? "Immediately, as soon as you confirm"
    : campaign.send_date && campaign.send_time
      ? formatPublishPreview(campaign.send_date, campaign.send_time, campaign.timezone)
      : "Not set";

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_420px]">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Review & confirm</h2>
          <p className="mt-1 text-sm text-slate-500">Check everything once more before it's locked in.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-5">
          <Row label="Audience" onEdit={isDraft ? () => onGoToStep(1) : undefined}>
            <p className="font-semibold">
              {stats ? `${stats.recipients} recipients` : campaign.recipient_count !== null ? `${campaign.recipient_count} recipients` : "Counting…"}
            </p>
            <p className="text-slate-500">{audienceNames.join(", ") || "None selected"}</p>
          </Row>
          <Row label="Sends" onEdit={isDraft ? () => onGoToStep(2) : undefined}>
            {whenLabel}
          </Row>
          <Row label="From" onEdit={isDraft ? () => onGoToStep(3) : undefined}>
            <p className="font-semibold">{campaign.from_name || "—"}</p>
            <p className="text-slate-500">
              {sender.fromAddress} · replies to {sender.replyTo}
            </p>
          </Row>
          <Row label="Subject" onEdit={isDraft ? () => onGoToStep(3) : undefined}>
            <p className="font-semibold">{campaign.subject || "—"}</p>
            <p className="text-slate-500">{campaign.preview_text || "No preview line"}</p>
          </Row>
          {(campaign.status === "sending" || campaign.status === "sent" || campaign.status === "failed") && (
            <Row label="Delivery">
              <p className="font-semibold">
                {campaign.status === "sending" ? "Sending… " : ""}
                {campaign.sent_count} sent{campaign.failed_count ? `, ${campaign.failed_count} failed` : ""}
              </p>
              {campaign.last_error && <p className="text-red-600">{campaign.last_error}</p>}
            </Row>
          )}
        </div>

        <TestSend campaignId={campaign.id} defaultTo={sender.replyTo} />

        <InboxPreview
          fromName={campaign.from_name}
          fromAddress={sender.fromAddress}
          subject={campaign.subject}
          previewText={campaign.preview_text}
        />

        {isDraft && (
          <>
            {problems.length > 0 && (
              <div className="rounded-xl bg-amber-50 px-5 py-4 text-sm text-amber-900">
                <p className="font-semibold">Before you can confirm:</p>
                <ul className="mt-1 list-disc pl-5">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            <button
              type="button"
              disabled={problems.length > 0 || !stats || stats.recipients === 0 || isConfirming}
              onClick={() => stats && onConfirm(stats.recipients, whenLabel)}
              className="w-full rounded-xl bg-slate-900 py-3.5 text-base font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
            >
              {isConfirming ? (campaign.send_immediately ? "Sending…" : "Scheduling…") : campaign.send_immediately ? "Confirm & Send" : "Confirm & Schedule"}
            </button>
          </>
        )}
      </div>

      <EmailPreview campaign={campaign} mailingAddress={sender.mailingAddress} />
    </div>
  );
}
