import { describe, expect, it } from "vitest";
import type { CandidateProfile } from "@prisma/client";
import { mapFormFields } from "../../src/modules/application-execution/mapping.js";
import { OPEN_LOCAL_FORM } from "../../src/modules/application-execution/adapters/local.js";
import type { ExecutionContext } from "../../src/modules/application-execution/types.js";

const profile = {
  headline: "Senior TypeScript Engineer",
  skills: ["TypeScript", "React"],
  noticePeriodDays: 30,
  expectedSalaryMin: 140000,
  expectedSalaryMax: 180000,
  salaryCurrency: "USD",
  verifiedFields: ["headline", "skills", "noticePeriodDays", "expectedSalaryMin"],
} as unknown as CandidateProfile;

function ctx(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    user: { id: "u1", email: "ada@example.com", name: "Ada Lovelace" },
    profile,
    application: {
      id: "a1",
      status: "APPROVED",
      coverLetter: "Verified cover letter",
      tailoredResume: "TypeScript, React",
      applicationUrl: "https://jobs.example.com/senior-typescript-engineer",
      resume: null,
      job: {
        title: "Senior TypeScript Engineer",
        company: "Northwind Labs",
        canonicalUrl: "https://jobs.example.com/senior-typescript-engineer",
        source: { name: "fixture" },
      },
      answers: [
        {
          fieldKey: "sponsorship",
          question: "Will you require visa sponsorship now or in the future?",
          answer: "I will confirm this myself.",
          source: "user_input",
          requiresReview: false,
        },
        {
          fieldKey: "work_authorization",
          question: "Are you legally authorized to work in the job location?",
          answer: "I will confirm authorization myself.",
          source: "user_input",
          requiresReview: false,
        },
        {
          fieldKey: "relocation",
          question: "Are you willing to relocate if required?",
          answer: "I will discuss relocation if asked.",
          source: "user_input",
          requiresReview: false,
        },
      ],
    },
    completedCheckpoints: [],
    ...overrides,
  };
}

describe("verified-data-only field mapping", () => {
  it("fills identity and package fields from verified data", () => {
    const mapped = mapFormFields(OPEN_LOCAL_FORM, ctx());
    expect(mapped.find((field) => field.kind === "name")?.value).toBe("Ada Lovelace");
    expect(mapped.find((field) => field.kind === "email")?.value).toBe("ada@example.com");
    expect(mapped.find((field) => field.kind === "cover_letter")?.filled).toBe(true);
    expect(mapped.find((field) => field.kind === "notice_period")?.value).toContain("30");
  });

  it("does not fill sponsorship from a generated guess", () => {
    const mapped = mapFormFields(OPEN_LOCAL_FORM, ctx({
      application: {
        ...ctx().application,
        answers: [
          {
            fieldKey: "sponsorship",
            question: "Will you require visa sponsorship now or in the future?",
            answer: "No",
            source: "generated",
            requiresReview: true,
          },
        ],
      },
    }));
    expect(mapped.find((field) => field.kind === "sponsorship")?.filled).toBe(false);
    expect(mapped.find((field) => field.kind === "sponsorship")?.requiresHuman).toBe(true);
  });

  it("never maps captcha, otp, or login values", () => {
    const mapped = mapFormFields(
      {
        ...OPEN_LOCAL_FORM,
        fields: [
          { key: "captcha", label: "CAPTCHA", kind: "captcha" },
          { key: "otp", label: "OTP", kind: "otp" },
          { key: "login", label: "Password", kind: "login" },
        ],
      },
      ctx(),
    );
    expect(mapped.every((field) => !field.filled && field.requiresHuman)).toBe(true);
  });
});
