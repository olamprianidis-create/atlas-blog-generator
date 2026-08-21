import type { NextApiRequest, NextApiResponse } from "next";
import { put } from "@vercel/blob";

// Images are sent as the raw request body (fetch(url, { body: file })),
// not multipart/form-data, so the default JSON body parser must be off.
export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

async function readBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

interface UploadImageResponse {
  url: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadImageResponse | { error: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: "Image uploads aren't configured yet (missing BLOB_READ_WRITE_TOKEN)." });
  }

  const contentType = req.headers["content-type"] ?? "";
  if (!ALLOWED_TYPES.includes(contentType)) {
    return res.status(400).json({ error: "Only JPG, PNG, WEBP, or GIF images are allowed." });
  }

  const filenameHeader = req.headers["x-filename"];
  const filename = typeof filenameHeader === "string" && filenameHeader ? filenameHeader : "";
  const extension = filename.split(".").pop() || contentType.split("/")[1] || "jpg";

  try {
    const body = await readBody(req);

    if (body.length === 0) {
      return res.status(400).json({ error: "No file provided." });
    }
    if (body.length > MAX_SIZE_BYTES) {
      return res.status(400).json({ error: "Image must be under 5MB." });
    }

    const blob = await put(`article-headers/${Date.now()}.${extension}`, body, {
      access: "public",
      contentType,
    });

    return res.status(200).json({ url: blob.url });
  } catch (error) {
    console.error("upload-image failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Upload failed: ${message}` });
  }
}
