import "server-only";

// Text extraction from an uploaded resume. Returns null when no text can be pulled
// (scanned/image-only PDF, password-protected, corrupt) — the orchestrator then yields
// `no_text_extracted` and onboarding routes the candidate to manual entry. Fail closed.

export interface ExtractInput {
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
}

export async function extractResumeText(input: ExtractInput): Promise<string | null> {
  const { bytes, mimeType, fileName } = input;
  const lower = fileName.toLowerCase();

  // Plain text — supported now (also the path our tests exercise).
  if (mimeType.startsWith("text/") || lower.endsWith(".txt")) {
    const text = new TextDecoder().decode(bytes).trim();
    return text || null;
  }

  // DOCX
  if (lower.endsWith(".docx") || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    try {
      // Lazy import keeps the dep out of the edge/runtime path until needed.
      const mammoth = await import("mammoth").catch(() => null);
      if (!mammoth) throw new Error("mammoth not installed");
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      const text = (value ?? "").trim();
      return text || null;
    } catch {
      return null; // routes to manual entry
    }
  }

  // PDF (pdf-parse v2: PDFParse class). Scanned/image-only PDFs yield no text → manual entry.
  if (lower.endsWith(".pdf") || mimeType === "application/pdf") {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: bytes });
      const result = await parser.getText();
      const text = (result.text ?? "").trim();
      return text || null;
    } catch {
      return null;
    }
  }

  return null; // unsupported type → manual entry
}
