import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../../utils/supabase";
import { postArticleToLinkedin } from "../../../../utils/linkedin";
import { buildArticleUrl } from "../../../../utils/site";

// Manual (re)trigger for the Published page's "Share to LinkedIn" button —
// covers articles published before LinkedIn was connected, or a post that
// failed the first time (e.g. an expired token) and needs a retry now
// that it's fixed. The automatic attempt lives in utils/publish.ts and
// fires once, right when an article is first published.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Missing article id." });
  }

  const supabase = getServiceClient();
  const { data: article, error: fetchError } = await supabase
    .from("scheduled_articles")
    .select("id, title, meta_description, status")
    .eq("id", id)
    .single();

  if (fetchError || !article) {
    return res.status(404).json({ error: "Article not found." });
  }
  if (article.status !== "published") {
    return res.status(400).json({ error: "Article isn't published yet." });
  }

  try {
    const urn = await postArticleToLinkedin({
      title: article.title,
      summary: article.meta_description ?? undefined,
      articleUrl: buildArticleUrl(article.title),
    });
    await supabase
      .from("scheduled_articles")
      .update({
        linkedin_status: "posted",
        linkedin_post_urn: urn,
        linkedin_error: null,
        linkedin_posted_at: new Date().toISOString(),
      })
      .eq("id", id);
    return res.status(200).json({ status: "posted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("isn't connected") || message.includes("connection expired") ? "not_connected" : "failed";
    await supabase
      .from("scheduled_articles")
      .update({ linkedin_status: status, linkedin_error: message })
      .eq("id", id);
    return res.status(502).json({ error: message });
  }
}
