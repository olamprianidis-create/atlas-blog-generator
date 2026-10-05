import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AppLayout from "../../../components/layout/AppLayout";
import StepAudience from "../../../components/email/StepAudience";
import StepSchedule from "../../../components/email/StepSchedule";
import StepSubject from "../../../components/email/StepSubject";
import StepContent from "../../../components/email/StepContent";
import StepReview from "../../../components/email/StepReview";
import {
  CAMPAIGN_STEPS,
  CampaignEdits,
  EDITABLE_CAMPAIGN_FIELDS,
  EmailCampaign,
  SenderSettings,
  campaignStatusLabel,
  hasAudience,
} from "../../../utils/emailCampaigns";

// Whether each step has what it needs — drives the ✓ in the step list.
function stepDone(step: number, c: EmailCampaign): boolean {
  switch (step) {
    case 1:
      return hasAudience(c);
    case 2:
      return c.send_immediately || Boolean(c.send_date && c.send_time);
    case 3:
      return Boolean(c.from_name.trim() && c.subject.trim());
    case 4:
      return Boolean(c.body_html.replace(/<[^>]+>/g, "").trim());
    default:
      return c.status !== "draft";
  }
}

export default function CampaignWizardPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : null;

  const [campaign, setCampaign] = useState<EmailCampaign | null>(null);
  const [sender, setSender] = useState<SenderSettings | null>(null);
  const [step, setStep] = useState(1);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/email/campaigns/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load campaign");
        setCampaign(data.campaign as EmailCampaign);
        setSender(data.sender as SenderSettings);
        setStep(data.campaign.status === "draft" ? data.campaign.current_step : 5);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load campaign"));
  }, [id]);

  const isDraft = campaign?.status === "draft";

  const update = useCallback((edits: CampaignEdits) => {
    setCampaign((current) => (current ? { ...current, ...edits } : current));
    setIsDirty(true);
  }, []);

  // Saves the editable fields; the server recomputes send_at from the
  // typed date/time/time zone and returns the canonical row.
  async function save(nextStep?: number): Promise<boolean> {
    if (!campaign || !isDraft) return true;
    setIsSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      for (const field of EDITABLE_CAMPAIGN_FIELDS) body[field] = campaign[field];
      if (nextStep) body.current_step = nextStep;
      const response = await fetch(`/api/email/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to save");
      setCampaign(data as EmailCampaign);
      setIsDirty(false);
      setSavedAt(new Date());
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function goToStep(next: number) {
    if (next === step) return;
    if (await save(Math.max(next, campaign?.current_step ?? 1))) setStep(next);
  }

  async function confirm(recipients: number, whenLabel: string) {
    if (!campaign) return;
    const question = campaign.send_immediately
      ? `Send "${campaign.subject}" to ${recipients} people now?`
      : `Schedule "${campaign.subject}" to ${recipients} people — ${whenLabel}?`;
    if (!window.confirm(question)) return;
    setIsConfirming(true);
    setError(null);
    try {
      const response = await fetch(`/api/email/campaigns/${campaign.id}/schedule`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to schedule");
      setCampaign(data as EmailCampaign);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule");
    } finally {
      setIsConfirming(false);
    }
  }

  async function unschedule() {
    if (!campaign) return;
    setError(null);
    try {
      const response = await fetch(`/api/email/campaigns/${campaign.id}/unschedule`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to unschedule");
      setCampaign(data as EmailCampaign);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unschedule");
    }
  }

  // Stable object so StepAudience's live count only refetches on real changes.
  const audience = useMemo(
    () =>
      campaign
        ? {
            audience_list_ids: campaign.audience_list_ids,
            include_all_members: campaign.include_all_members,
            include_all_contacts: campaign.include_all_contacts,
          }
        : null,
    [campaign?.audience_list_ids, campaign?.include_all_members, campaign?.include_all_contacts] // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!campaign || !sender || !audience) {
    return (
      <AppLayout>
        <main className="flex-1 p-10 text-sm text-slate-500">{error ?? "Loading campaign…"}</main>
      </AppLayout>
    );
  }

  return (
    <AppLayout contentClassName="flex flex-1 overflow-hidden">
      <aside className="w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white px-4 py-6">
        <Link href="/email/campaigns" className="px-2 text-xs font-medium text-slate-500 hover:text-slate-900">
          ← All campaigns
        </Link>
        <p className="mt-5 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">New campaign</p>
        <ol className="mt-3 space-y-1">
          {CAMPAIGN_STEPS.map((s) => {
            const isActive = s.number === step;
            const done = stepDone(s.number, campaign);
            const clickable = isDraft;
            return (
              <li key={s.number}>
                <button
                  type="button"
                  disabled={!clickable || isSaving}
                  onClick={() => void goToStep(s.number)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    isActive ? "bg-blue-50 font-medium text-blue-700" : "text-slate-500 hover:bg-slate-50"
                  } disabled:cursor-default disabled:hover:bg-transparent`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      isActive ? "bg-blue-600 text-white" : done ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {done && !isActive ? "✓" : s.number}
                  </span>
                  {s.label}
                </button>
              </li>
            );
          })}
        </ol>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto max-w-5xl">
            {!isDraft && (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-green-50 px-5 py-4 text-sm text-green-900">
                <div>
                  <p className="font-semibold">
                    {campaignStatusLabel(campaign.status)}
                    {campaign.status === "scheduled" && campaign.send_at &&
                      ` for ${new Date(campaign.send_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`}
                  </p>
                  {campaign.status === "scheduled" && (
                    <p className="text-green-800">
                      To make changes, unschedule it first — it goes back to Drafts.
                    </p>
                  )}
                </div>
                {campaign.status === "scheduled" && (
                  <button
                    type="button"
                    onClick={unschedule}
                    className="rounded-lg border border-green-700 px-3 py-1.5 font-medium text-green-900 hover:bg-green-100"
                  >
                    Unschedule & edit
                  </button>
                )}
              </div>
            )}

            {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

            {step === 1 && (
              <StepAudience selection={audience} onChange={(next) => update(next)} />
            )}
            {step === 2 && (
              <StepSchedule
                value={{
                  send_immediately: campaign.send_immediately,
                  send_date: campaign.send_date,
                  send_time: campaign.send_time,
                  timezone: campaign.timezone,
                }}
                onChange={(next) => update(next)}
              />
            )}
            {step === 3 && (
              <StepSubject
                value={{ from_name: campaign.from_name, subject: campaign.subject, preview_text: campaign.preview_text }}
                onChange={(next) => update(next)}
                fromAddress={sender.fromAddress}
                replyTo={sender.replyTo}
                bodyHtml={campaign.body_html}
              />
            )}
            {step === 4 && (
              <StepContent
                bodyHtml={campaign.body_html}
                onChange={(html) => update({ body_html: html })}
                subject={campaign.subject}
                fromName={campaign.from_name}
                previewText={campaign.preview_text}
                mailingAddress={sender.mailingAddress}
              />
            )}
            {step === 5 && (
              <StepReview
                campaign={campaign}
                sender={sender}
                onGoToStep={(s) => void goToStep(s)}
                onConfirm={confirm}
                isConfirming={isConfirming}
              />
            )}
          </div>
        </div>

        {isDraft && (
          <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-8 py-3">
            <button
              type="button"
              onClick={() => void goToStep(step - 1)}
              disabled={step === 1 || isSaving}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-30"
            >
              ← Back
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                {isSaving ? "Saving…" : isDirty ? "Unsaved changes" : savedAt ? `Draft saved ${savedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}
              </span>
              <button
                type="button"
                onClick={() => void save()}
                disabled={isSaving || !isDirty}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Save draft
              </button>
              {step < 5 && (
                <button
                  type="button"
                  onClick={() => void goToStep(step + 1)}
                  disabled={isSaving}
                  className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
                >
                  Continue →
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </AppLayout>
  );
}
