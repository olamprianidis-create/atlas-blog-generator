import type { NextApiRequest, NextApiResponse } from "next";
import { detectDocumentExtension, extractTextFromDocument } from "../../utils/documentExtraction";

interface ExtractDocumentResponse {
  text: string;
  charCount: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ExtractDocumentResponse | { error: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url, filename } = req.body as { url?: unknown; filename?: unknown };

  if (typeof url !== "string" || !url) {
    return res.status(400).json({ error: "Missing url" });
  }
  if (typeof filename !== "string" || !filename) {
    return res.status(400).json({ error: "Missing filename" });
  }

  const extension = detectDocumentExtension(filename);
  if (!extension) {
    return res.status(400).json({
      error: "Unsupported file type — upload a PDF, Word (.docx), text/Markdown, CSV, PNG, or JPG file.",
    });
  }

  try {
    const fileResponse = await fetch(url);
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch the uploaded file (status ${fileResponse.status})`);
    }

    const buffer = Buffer.from(await fileResponse.arrayBuffer());
    const text = await extractTextFromDocument(buffer, extension, filename);

    if (!text) {
      return res.status(422).json({ error: "No readable text was found in this file." });
    }

    return res.status(200).json({ text, charCount: text.length });
  } catch (error) {
    console.error("extract-document failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Failed to read document: ${message}` });
  }
}
