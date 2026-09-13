import { afterEach, describe, expect, it } from "vitest";
import { ForbiddenError } from "../../src/lib/errors.js";
import { resolveStoragePath } from "../../src/storage/index.js";
import { assertProductionSecrets } from "../../src/config/env.js";
import { safeDownloadName, looksLikePdf, looksLikeZip } from "../../src/lib/files.js";
import { assertResumeFile } from "../../src/modules/resume/extract-text.js";

describe("secure file handling", () => {
  it("rejects path traversal keys", () => {
    expect(() => resolveStoragePath("../secret.pdf")).toThrow(ForbiddenError);
    expect(() => resolveStoragePath("user/../../etc/passwd")).toThrow(ForbiddenError);
    expect(() => resolveStoragePath("")).toThrow(ForbiddenError);
  });

  it("accepts generated owner-scoped keys", () => {
    const dest = resolveStoragePath("user123/2026-09-13/file.docx");
    expect(dest.replaceAll("\\", "/")).toContain("user123/2026-09-13/file.docx");
  });

  it("strips header-injection characters from download names", () => {
    expect(safeDownloadName('evil\r\nSet-Cookie: x="1".pdf')).not.toMatch(/[\r\n]/);
    expect(safeDownloadName('cv"x.docx')).not.toContain('"');
  });

  it("rejects spoofed PDF or DOCX bytes", () => {
    expect(() =>
      assertResumeFile(
        { mimetype: "application/pdf", size: 12, originalname: "cv.pdf", buffer: Buffer.from("not a pdf") },
        8_000_000,
      ),
    ).toThrow(/valid PDF/);
    expect(() =>
      assertResumeFile(
        {
          mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          size: 12,
          originalname: "cv.docx",
          buffer: Buffer.from("not a zip"),
        },
        8_000_000,
      ),
    ).toThrow(/valid DOCX/);
    expect(looksLikePdf(Buffer.from("%PDF-1.7"))).toBe(true);
    expect(looksLikeZip(Buffer.from("PK\u0003\u0004"))).toBe(true);
  });
});

describe("production secrets", () => {
  const jwt = process.env.JWT_SECRET;
  afterEach(() => {
    process.env.JWT_SECRET = jwt;
  });

  it("rejects the development JWT default in production", () => {
    expect(() =>
      assertProductionSecrets({ NODE_ENV: "production" }, { JWT_SECRET: "dev-only-change-me-now-32" }),
    ).toThrow(/JWT_SECRET/);
    expect(() =>
      assertProductionSecrets({ NODE_ENV: "production" }, { JWT_SECRET: "short" }),
    ).toThrow(/JWT_SECRET/);
    expect(() =>
      assertProductionSecrets({ NODE_ENV: "production" }, { JWT_SECRET: "a".repeat(32) }),
    ).not.toThrow();
    expect(() => assertProductionSecrets({ NODE_ENV: "test" }, {})).not.toThrow();
  });
});
