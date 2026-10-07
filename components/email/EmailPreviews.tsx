import { useState } from "react";
import { renderCampaignEmail } from "../../utils/emailTemplate";
import {
  DEFAULT_BODY_STYLE,
  DEFAULT_HEADER_STYLE,
  EmailCampaign,
  personalizeHtml,
  personalizeText,
  withSectionDefaults,
} from "../../utils/emailCampaigns";

// Previews fill {{first_name}} with a sample name so they read like a real email.
export const PREVIEW_FIRST_NAME = "Odysseas";

// How the email shows up in an inbox list — sender, address, subject,
// preview line — mirroring the layout the user sketched.
export function InboxPreview({
  fromName,
  fromAddress,
  subject,
  previewText,
}: {
  fromName: string;
  fromAddress: string;
  subject: string;
  previewText: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Inbox preview</p>
      <div className="mt-3 flex gap-3">
        <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-[15px] font-bold text-slate-900">{fromName || "Sender name"}</p>
            <p className="shrink-0 text-xs text-slate-400">9:41 AM</p>
          </div>
          <p className="truncate text-xs text-slate-500">{fromAddress}</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900">
            {personalizeText(subject, PREVIEW_FIRST_NAME) || "Your subject line"}
          </p>
          <p className="line-clamp-2 text-sm text-slate-500">
            {personalizeText(previewText, PREVIEW_FIRST_NAME) || "Your preview line shows here…"}
          </p>
        </div>
      </div>
    </div>
  );
}

// The full rendered email in a sandboxed iframe (same template the real
// send uses), with a desktop/mobile width toggle.
export function EmailPreview({
  campaign,
  mailingAddress,
}: {
  campaign: Pick<EmailCampaign, "header_html" | "header_style" | "body_html" | "body_style" | "preview_text">;
  mailingAddress: string;
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const html = renderCampaignEmail({
    headerHtml: personalizeHtml(campaign.header_html, PREVIEW_FIRST_NAME),
    headerStyle: withSectionDefaults(campaign.header_style, DEFAULT_HEADER_STYLE),
    bodyHtml: personalizeHtml(campaign.body_html, PREVIEW_FIRST_NAME),
    bodyStyle: withSectionDefaults(campaign.body_style, DEFAULT_BODY_STYLE),
    previewText: personalizeText(campaign.preview_text, PREVIEW_FIRST_NAME),
    mailingAddress,
    unsubscribeUrl: "#",
  });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Email preview</p>
        <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
          {(["desktop", "mobile"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDevice(d)}
              className={`rounded-md px-3 py-1 capitalize ${device === d ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-center rounded-xl border border-slate-200 bg-slate-100 p-3">
        <iframe
          title="Email preview"
          srcDoc={html}
          sandbox=""
          className="h-[560px] rounded-lg bg-white transition-[width] duration-200"
          style={{ width: device === "desktop" ? "100%" : 375 }}
        />
      </div>
    </div>
  );
}
