// Extracts plain text from an uploaded reference document (PDF, Word doc,
// plain text/Markdown, or CSV) so its content can be woven into the
// research context alongside web search findings. See
// utils/referenceDocuments.ts for how that extracted text is turned into
// research entries the outline/article generation prompts consume.

export type SupportedDocumentExtension = "pdf" | "docx" | "txt" | "md" | "csv";

const EXTENSION_MAP: Record<string, SupportedDocumentExtension> = {
  pdf: "pdf",
  docx: "docx",
  txt: "txt",
  md: "md",
  markdown: "md",
  csv: "csv",
};

export function detectDocumentExtension(filename: string): SupportedDocumentExtension | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MAP[ext] ?? null;
}

// Caps how much of one document's text gets sent to the model — a single
// 200-page PDF shouldn't blow up the prompt's token cost. Generous enough
// (~5,000 words) to cover most reports/whitepapers in full.
const MAX_EXTRACTED_CHARS = 20000;

export async function extractTextFromDocument(
  buffer: Buffer,
  extension: SupportedDocumentExtension
): Promise<string> {
  let text: string;

  switch (extension) {
    case "pdf": {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        text = result.text;
      } finally {
        await parser.destroy();
      }
      break;
    }
    case "docx": {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
      break;
    }
    case "txt":
    case "md":
    case "csv":
      text = buffer.toString("utf-8");
      break;
  }

  return text.trim().slice(0, MAX_EXTRACTED_CHARS);
}
