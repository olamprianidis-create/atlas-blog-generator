// Renders a campaign's final email HTML — the branded wrapper around the
// body written in the wizard. Used for the in-wizard preview now and for
// the real send later, so what you preview is exactly what goes out.
// Inline styles + table layout on purpose: email clients (Gmail, Outlook)
// ignore <style> blocks and most modern CSS.

export interface EmailTemplateInput {
  bodyHtml: string;
  previewText: string;
  mailingAddress: string;
  unsubscribeUrl: string;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Inline styles applied to the body's own tags, since email clients drop
// <style> blocks.
function styleBody(html: string): string {
  return html
    .replace(/<p(?=[\s>])/g, '<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#0f172a"')
    .replace(/<h2(?=[\s>])/g, '<h2 style="margin:24px 0 12px;font-size:20px;line-height:1.3;color:#0f172a"')
    .replace(/<ul(?=[\s>])/g, '<ul style="margin:0 0 16px;padding-left:24px;font-size:16px;line-height:1.6;color:#0f172a"')
    .replace(/<ol(?=[\s>])/g, '<ol style="margin:0 0 16px;padding-left:24px;font-size:16px;line-height:1.6;color:#0f172a"')
    .replace(/<a(?=[\s>])/g, '<a style="color:#517590;text-decoration:underline"');
}

export function renderCampaignEmail({ bodyHtml, previewText, mailingAddress, unsubscribeUrl }: EmailTemplateInput): string {
  // Hidden preheader: the inbox preview line. The trailing &zwnj;&nbsp;
  // padding stops clients from pulling body text into the preview.
  const preheader = previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(previewText)}${"&zwnj;&nbsp;".repeat(60)}</div>`
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
      <tr><td style="padding:28px 32px;border-bottom:1px solid #000000;text-align:center">
        <span style="font-size:22px;font-weight:900;letter-spacing:2px;color:#000000">ATLAS NETWORK</span>
      </td></tr>
      <tr><td style="padding:32px">
        ${styleBody(bodyHtml)}
      </td></tr>
      <tr><td style="padding:24px 32px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;line-height:1.6;color:#64748b">
        ATLAS Network · ${escapeHtml(mailingAddress)}<br>
        You're receiving this because you're connected with ATLAS Network.<br>
        <a href="${escapeHtml(unsubscribeUrl)}" style="color:#64748b;text-decoration:underline">Unsubscribe</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
