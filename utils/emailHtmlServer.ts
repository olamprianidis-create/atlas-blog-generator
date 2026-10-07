// Server-side counterpart to sanitizeEmailHtml (components/email/
// EmailSectionEditor.tsx, which needs a browser DOM). Used for HTML the
// server writes straight into a campaign without passing through the
// editor — keeps only the tags the email template styles, and only safe
// hrefs on links.
const ALLOWED = new Set(["p", "br", "h2", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a"]);

export function sanitizeEmailHtmlServer(html: string): string {
  return html
    .replace(/<(script|style|iframe|object)[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (tag, name: string, attrs: string) => {
      const lower = name.toLowerCase();
      if (!ALLOWED.has(lower)) return "";
      if (tag.startsWith("</")) return `</${lower}>`;
      if (lower === "a") {
        const href = attrs.match(/href\s*=\s*"([^"]*)"/i)?.[1] ?? attrs.match(/href\s*=\s*'([^']*)'/i)?.[1];
        return href && /^(https?:|mailto:)/i.test(href) ? `<a href="${href.replace(/"/g, "&quot;")}">` : "<a>";
      }
      return `<${lower}>`;
    });
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
