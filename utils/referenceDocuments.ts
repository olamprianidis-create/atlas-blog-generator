import type { ResearchQuery } from "./webSearch";

// What the client sends once a document has already been uploaded and
// extracted (see components/steps/DocumentUpload.tsx + pages/api/extract-document.ts)
// — just the filename and the already-extracted text, no re-parsing here.
export interface ReferenceDocumentInput {
  name: string;
  extractedText: string;
}

export function isReferenceDocumentList(value: unknown): value is ReferenceDocumentInput[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as ReferenceDocumentInput).name === "string" &&
        typeof (item as ReferenceDocumentInput).extractedText === "string"
    )
  );
}

// Reshapes uploaded documents into the same ResearchQuery[] shape as web
// search findings, so outline/article generation can treat "the user's
// uploaded report" and "a web search result" as one unified research list
// with no separate prompt-plumbing needed. Each document becomes its own
// entry; long text is split into paragraph-sized findings so it renders
// as a readable bullet list in the prompt rather than one giant blob.
export function documentsToResearchQueries(documents: ReferenceDocumentInput[]): ResearchQuery[] {
  return documents.map((doc) => {
    const paragraphs = doc.extractedText
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

    return {
      query: `User-uploaded reference document: ${doc.name}`,
      findings: paragraphs.length > 0 ? paragraphs : [doc.extractedText.trim()],
    };
  });
}
