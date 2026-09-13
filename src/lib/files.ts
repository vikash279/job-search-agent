export function safeDownloadName(name: string): string {
  const cleaned = name
    .replace(/[\r\n\0]/g, "")
    .replace(/[\\"]/g, "")
    .replace(/[^\x20-\x7E]/g, "_")
    .trim();
  return cleaned.slice(0, 120) || "resume";
}

export function looksLikePdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString("utf8") === "%PDF-";
}

export function looksLikeZip(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}
