import mammoth from "mammoth";
import { ValidationError } from "../../lib/errors.js";
import { looksLikePdf, looksLikeZip } from "../../lib/files.js";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function assertResumeFile(
  file: { mimetype: string; size: number; originalname: string; buffer?: Buffer },
  maxBytes: number,
) {
  const ext = file.originalname.toLowerCase();
  const allowedExt = ext.endsWith(".pdf") || ext.endsWith(".docx");
  if (!ALLOWED_TYPES.has(file.mimetype) && !allowedExt) {
    throw new ValidationError("Only PDF and DOCX resumes are supported");
  }
  if (file.size > maxBytes) {
    throw new ValidationError(`File exceeds the ${Math.round(maxBytes / (1024 * 1024))}MB limit`);
  }
  if (file.buffer && file.buffer.length > 0) {
    const pdf = ext.endsWith(".pdf") || file.mimetype === "application/pdf";
    if (pdf && !looksLikePdf(file.buffer)) {
      throw new ValidationError("File content is not a valid PDF");
    }
    if (!pdf && !looksLikeZip(file.buffer)) {
      throw new ValidationError("File content is not a valid DOCX document");
    }
  }
}

export async function extractResumeText(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<string> {
  const isDocx =
    mimeType.includes("wordprocessingml") || filename.toLowerCase().endsWith(".docx");
  if (isDocx) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  const pdfParse = (await import("pdf-parse")).default as (buf: Buffer) => Promise<{ text: string }>;
  const parsed = await pdfParse(buffer);
  return parsed.text.trim();
}
