// Strips HTML tags from a NoteRichTextEditor value (see
// components/NoteRichTextEditor.tsx) down to plain text — used wherever
// the formatted note body needs to go somewhere that doesn't render
// HTML (e.g. a Google Calendar event description, a Discord message).
export function stripHtml(html: string): string {
  return html
    .replace(/<(br|\/div|\/p|\/li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
