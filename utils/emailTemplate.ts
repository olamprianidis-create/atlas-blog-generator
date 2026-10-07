// Renders a campaign's final email HTML — the branded wrapper around the
// body written in the wizard. Used for the in-wizard preview now and for
// the real send later, so what you preview is exactly what goes out.
// Inline styles + table layout on purpose: email clients (Gmail, Outlook)
// ignore <style> blocks and most modern CSS.

import { SectionStyle, fontStack } from "./emailCampaigns";

// Footer sign-off (requested 2026-10-07): sender name, mailing address,
// a thank-you note that ends with the unsubscribe link.
const FOOTER_NAME = "Odysseas Lamprianidis";
const FOOTER_MESSAGE =
  "Thank you for your support, love, and encouragement over the years. I'm grateful to say we've built something beautiful together. My hope is you find much value here, make many great friends, and feel empowered to make positive change.";

export interface EmailTemplateInput {
  headerHtml: string;
  headerStyle: SectionStyle;
  bodyHtml: string;
  bodyStyle: SectionStyle;
  previewText: string;
  mailingAddress: string;
  unsubscribeUrl: string;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function hasText(html: string): boolean {
  return html.replace(/<[^>]+>|&nbsp;/g, "").trim().length > 0;
}

// Inline styles applied to the section's own tags, since email clients drop
// <style> blocks. Font, color and alignment are inherited from the <td>.
function styleSection(html: string, style: SectionStyle, paragraphMargin: string): string {
  const size = `font-size:${style.fontSize}px;line-height:1.5`;
  return html
    .replace(/<p(?=[\s>])/g, `<p style="margin:${paragraphMargin};${size}"`)
    .replace(/<h2(?=[\s>])/g, `<h2 style="margin:24px 0 12px;font-size:${Math.round(style.fontSize * 1.25)}px;line-height:1.3"`)
    .replace(/<ul(?=[\s>])/g, `<ul style="margin:0 0 16px;padding-left:24px;${size};text-align:left"`)
    .replace(/<ol(?=[\s>])/g, `<ol style="margin:0 0 16px;padding-left:24px;${size};text-align:left"`)
    .replace(/<a(?=[\s>])/g, '<a style="color:#517590;text-decoration:underline"');
}

function sectionCell(style: SectionStyle, padding: string): string {
  return `padding:${padding};background:${style.backgroundColor};text-align:${style.align};font-family:${fontStack(style.fontFamily)};font-size:${style.fontSize}px;line-height:1.5;color:#0f172a`;
}

export function renderCampaignEmail({
  headerHtml,
  headerStyle,
  bodyHtml,
  bodyStyle,
  previewText,
  mailingAddress,
  unsubscribeUrl,
}: EmailTemplateInput): string {
  // Hidden preheader: the inbox preview line. The trailing &zwnj;&nbsp;
  // padding stops clients from pulling body text into the preview.
  const preheader = previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(previewText)}${"&zwnj;&nbsp;".repeat(60)}</div>`
    : "";
  // The header is optional — left out entirely when empty.
  const header = hasText(headerHtml)
    ? `<tr><td style="${sectionCell(headerStyle, "28px 32px")}">
        ${styleSection(headerHtml, headerStyle, "0")}
      </td></tr>`
    : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
      ${header}
      <tr><td style="${sectionCell(bodyStyle, "32px")}">
        ${styleSection(bodyHtml, bodyStyle, "0 0 16px")}
      </td></tr>
      <tr><td style="padding:24px 32px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;line-height:1.6;color:#64748b">
        ${FOOTER_NAME}<br>
        ${escapeHtml(mailingAddress)}<br><br>
        ${escapeHtml(FOOTER_MESSAGE)} If I have failed to help you achieve this, you are welcome to
        <a href="${escapeHtml(unsubscribeUrl)}" style="color:#64748b;text-decoration:underline">unsubscribe</a> here.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
