import { describe, expect, it } from "vitest";
import { heuristicParseResume } from "../../src/modules/resume/heuristic-parse.js";
import { assertResumeFile } from "../../src/modules/resume/extract-text.js";
import { parsedProfileSchema } from "../../src/ai/schemas.js";

const SAMPLE = `Jane Doe
Senior TypeScript Engineer
Summary
Full-stack engineer with 8 years experience in TypeScript and React.
Skills
TypeScript, React, Node, PostgreSQL, AWS
Experience
Senior Engineer - Northwind
Education
MIT
Achievements
Shipped a design system
`;

describe("CV parsing validation", () => {
  it("extracts structured fields without inventing employers", () => {
    const parsed = heuristicParseResume(SAMPLE);
    expect(parsed.skills.length).toBeGreaterThan(0);
    expect(parsed.yearsExperience).toBe(8);
    expect(parsedProfileSchema.parse(parsed).skills).toEqual(expect.arrayContaining(["Typescript"]));
  });

  it("rejects unsupported file types", () => {
    expect(() =>
      assertResumeFile({ mimetype: "image/png", size: 100, originalname: "photo.png" }, 8_000_000),
    ).toThrow(/PDF and DOCX/);
  });

  it("rejects spoofed PDF content when a buffer is present", () => {
    expect(() =>
      assertResumeFile(
        { mimetype: "application/pdf", size: 8, originalname: "cv.pdf", buffer: Buffer.from("hello") },
        8_000_000,
      ),
    ).toThrow(/valid PDF/);
  });

  it("rejects oversized files", () => {
    expect(() =>
      assertResumeFile(
        { mimetype: "application/pdf", size: 20_000_000, originalname: "cv.pdf" },
        8_000_000,
      ),
    ).toThrow(/exceeds/);
  });
});
