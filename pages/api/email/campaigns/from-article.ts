import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../../utils/supabase";
import { generateJSON } from "../../../../utils/anthropic";
import { buildArticleUrl } from "../../../../utils/site";
import { DEFAULT_TIMEZONE, buildPublishDate, parsePublishDate } from "../../../../utils/timezones";
import { escapeHtml, sanitizeEmailHtmlServer } from "../../../../utils/emailHtmlServer";
import { errorMessage } from "../../../../utils/errorMessage";

export const config = { maxDuration: 60 };

// The email goes out this long after the article publishes, so its link is
// already live (the publish cron runs articles before campaigns, but this
// leaves room for a slow or retried publish).
const SEND_AFTER_ARTICLE_MINUTES = 30;
const ARTICLE_CHARS = 14_000;

interface Draft {
  subject: string;
  preview_text: string;
  header: string;
  body_html: string;
}

const MOCK: Draft = {
  subject: "[Mock] Subject",
  preview_text: "[Mock] Preview line",
  header: "[Mock] Header",
  body_html: "<p>[Mock] Hi there,</p><p>Set ANTHROPIC_MOCK_MODE=false for real output.</p>",
};

// "Create Email Blast" on blog Step 5: drafts an email campaign from a
// scheduled article — subject, preview line, header, body (linking to the
// article) and a send time just after the article goes live. Sender name
// and audience are left for the admin; the wizard flags what's missing.
export default async function handler(req: NextApiRequest, res: NextApiResponse<{ id: string } | { error: string }>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const articleId = typeof req.body?.articleId === "string" ? req.body.articleId : "";
  if (!articleId) return res.status(400).json({ error: "Missing article id" });

  const supabase = getServiceClient();
  try {
    const { data: article, error } = await supabase
      .from("scheduled_articles")
      .select("id, title, content_markdown, meta_description, publish_date, status")
      .eq("id", articleId)
      .maybeSingle();
    if (error) throw error;
    if (!article) return res.status(404).json({ error: "Article not found" });

    const url = buildArticleUrl(article.title as string);
    const prompt = `You're turning a blog article into an email for ATLAS Network's community — entrepreneurs and ambitious young professionals (atlasnetwork.club). The email goes out right after the article is published.

Article title: ${article.title}
Article URL: ${url}
Meta description: ${article.meta_description ?? ""}

Article (markdown):
"""
${(article.content_markdown as string).slice(0, ARTICLE_CHARS)}
"""

Write:
1. "subject" — an email subject line (under 60 characters) that makes the reader want to open it. Personal, curious or benefit-led; not clickbait, no ALL CAPS, no emoji.
2. "preview_text" — the inbox preview line (40–110 characters) that complements the subject rather than repeating it.
3. "header" — a short headline shown at the top of the email (under 60 characters).
4. "body_html" — the email body. It must deliver real value on its own: lead with the article's single most useful insight in a sentence or two, then 2–4 short takeaways (a <ul> works well), then invite them to read the full article with ONE link: <a href="${url}">descriptive link text</a>. 150–250 words. Warm, direct, personal — written by a real person, not a corporation; short paragraphs (1–3 sentences). Open with "Hi there," (no name merge tags). No sign-off name (leave the last line as a natural closing sentence).

Rules:
- Only use facts that are in the article. Never invent names, numbers, dates, quotes or claims.
- Use exactly the URL given — never invent or alter links.
- Do NOT include an unsubscribe line, address, or header inside body_html — the template adds those.
- body_html uses only <p>, <h2>, <strong>, <em>, <ul>, <ol>, <li>, <a href>, <br>. No inline styles, no images.

Return JSON: {"subject":"...","preview_text":"...","header":"...","body_html":"..."}`;

    const draft = await generateJSON<Draft>(prompt, MOCK, { maxTokens: 4000 });
    let body = sanitizeEmailHtmlServer(String(draft.body_html ?? ""));
    // The one thing this email must do is link to the article.
    if (!body.includes(url)) body += `<p><a href="${url}">Read the full article</a></p>`;

    // Pre-fill the send time only if the article hasn't gone out yet.
    const publishAt = article.publish_date ? new Date(article.publish_date as string) : null;
    let schedule: Record<string, string> = {};
    if (article.status !== "published" && publishAt && publishAt.getTime() > Date.now()) {
      const sendAt = new Date(publishAt.getTime() + SEND_AFTER_ARTICLE_MINUTES * 60_000);
      const { date, time } = parsePublishDate(sendAt.toISOString(), DEFAULT_TIMEZONE);
      schedule = {
        send_date: date,
        send_time: time,
        timezone: DEFAULT_TIMEZONE,
        send_at: buildPublishDate(date, time, DEFAULT_TIMEZONE).toISOString(),
      };
    }

    const { data: campaign, error: insertError } = await supabase
      .from("email_campaigns")
      .insert({
        source_article_id: article.id,
        subject: String(draft.subject ?? "").trim().slice(0, 150),
        preview_text: String(draft.preview_text ?? "").trim().slice(0, 200),
        header_html: draft.header ? `<p><strong>${escapeHtml(String(draft.header).trim())}</strong></p>` : "",
        body_html: body,
        current_step: 1,
        ...schedule,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;
    return res.status(201).json({ id: campaign.id as string });
  } catch (error) {
    console.error("email from article failed:", error);
    const message = errorMessage(error);
    return res.status(502).json({ error: `Couldn't create the email: ${message}` });
  }
}
