import { describe, expect, it } from "vitest";
import { parsedProfileSchema } from "../../src/ai/schemas.js";
import { parseResumeProfile } from "../../src/modules/resume/parse-service.js";
import { groundParsedProfile } from "../../src/modules/resume/ground-profile.js";

const SOURCE = `Priya Shah
Senior TypeScript Engineer
Summary
Backend engineer with 6 years experience in TypeScript and Node.
Skills
TypeScript, Node, PostgreSQL
Experience
Staff Engineer - Harbor Labs
Education
IIT Bombay
`;

describe("AI output validation", () => {
  it("rejects invalid parsed profiles", () => {
    expect(() => parsedProfileSchema.parse({ yearsExperience: "many" })).toThrow();
  });

  it("drops invented skills, salary, and employers", () => {
    const grounded = groundParsedProfile(
      SOURCE,
      parsedProfileSchema.parse({
        skills: ["TypeScript", "COBOL", "Kubernetes"],
        experience: [{ title: "CEO", company: "Invented Corp", highlights: [] }],
        education: [{ school: "IIT Bombay" }],
        expectedSalaryMin: 400000,
        noticePeriodDays: 15,
      }),
    );
    expect(grounded.skills).toEqual(["TypeScript"]);
    expect(grounded.experience).toHaveLength(0);
    expect(grounded.education[0]?.school).toBe("IIT Bombay");
    expect(grounded.expectedSalaryMin).toBeUndefined();
    expect(grounded.noticePeriodDays).toBeUndefined();
  });

  it("parses a CV without inventing salary or notice period", async () => {
    const parsed = await parseResumeProfile(SOURCE);
    expect(parsed.skills.map((s) => s.toLowerCase())).toEqual(
      expect.arrayContaining(["typescript", "node"]),
    );
    expect(parsed.expectedSalaryMin).toBeUndefined();
    expect(parsed.noticePeriodDays).toBeUndefined();
    expect(parsedProfileSchema.parse(parsed).skills.length).toBeGreaterThan(0);
  });
});
