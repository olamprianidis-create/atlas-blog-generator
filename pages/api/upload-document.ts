import type { NextApiRequest, NextApiResponse } from "next";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

// Reference documents (PDFs, Word docs, text/CSV) upload straight from the
// browser to Blob storage — same pattern as upload-video.ts — this route
// only hands out a short-lived client token. Text is then extracted
// server-side from the resulting blob URL (see pages/api/extract-document.ts).
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

// Browsers are inconsistent about the MIME type they report for
// .md/.csv files (some send "application/octet-stream" or omit a
// recognized type entirely), so that's allowed here too — the actual
// file-type gate is by extension, in extract-document.ts.
const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "text/csv",
  "application/vnd.ms-excel",
  "application/csv",
  "application/octet-stream",
  "image/png",
  "image/jpeg",
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: "Document uploads aren't configured yet (missing BLOB_READ_WRITE_TOKEN)." });
  }

  const body = req.body as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        maximumSizeInBytes: MAX_SIZE_BYTES,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        // No DB write here — the wizard keeps the extracted text in its
        // own draft state (DraftState's jsonb blob), same as headerImageUrl.
      },
    });

    return res.status(200).json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(400).json({ error: message });
  }
}
