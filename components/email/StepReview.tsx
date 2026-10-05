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
        include_all_members: campaign.include_all_members,
        include_all_contacts: campaign.include_all_contacts,
      }),
    })
      .then((r) => r.json())
      .then((data) => setStats(data as AudienceStats))
      .catch(() => undefined);
  }, [campaign.audience_list_ids, campaign.include_all_members, campaign.include_all_contacts]);

  const audienceNames = [
    campaign.include_all_members && "All ATLAS Members",
    campaign.include_all_contacts && "All Contacts",
    ...(campaign.include_all_contacts
      ? []
      : campaign.audience_list_ids.map((id) => options?.lists.find((l) => l.id === id)?.name ?? "List")),
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
        </div>

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
              {isConfirming ? "Scheduling…" : campaign.send_immediately ? "Confirm & Send" : "Confirm & Schedule"}
            </button>
          </>
        )}
      </div>

      <EmailPreview bodyHtml={campaign.body_html} previewText={campaign.preview_text} mailingAddress={sender.mailingAddress} />
    </div>
  );
}
