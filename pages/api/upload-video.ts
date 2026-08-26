import type { NextApiRequest, NextApiResponse } from "next";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

// Videos upload straight from the browser to Blob storage (this route only
// hands out a short-lived client token) — routing multi-hundred-MB video
// files through a serverless function body would blow past Vercel's
// request size limit, unlike the small-image flow in upload-image.ts.
const MAX_SIZE_BYTES = 500 * 1024 * 1024;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: "Video uploads aren't configured yet (missing BLOB_READ_WRITE_TOKEN)." });
  }

  const body = req.body as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => ({
        allowedContentTypes: ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"],
        maximumSizeInBytes: MAX_SIZE_BYTES,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ pathname }),
      }),
      onUploadCompleted: async () => {
        // No DB write needed here — the Uploads page creates the
        // video_uploads row itself once it has the final blob URL.
      },
    });

    return res.status(200).json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(400).json({ error: message });
  }
}
