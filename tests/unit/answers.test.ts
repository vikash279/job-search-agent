import { describe, expect, it } from "vitest";
import { draftAnswers, extractQuestions, verifyAnswerAgainstProfile } from "../../src/modules/application-preparation/answers.js";
import type { CandidateProfile } from "@prisma/client";

const profile = {
  skills: ["TypeScript"],
  noticePeriodDays: 30,
  expectedSalaryMin: 140000,
  salaryCurrency: "USD",
  verifiedFields: ["noticePeriodDays", "expectedSalaryMin", "skills"],
} as unknown as CandidateProfile;

describe("answer verification", () => {
  it("extracts default sensitive questions", () => {
    const questions = extractQuestions("Are you excited about TypeScript?");
    expect(questions.some((q) => /sponsor/i.test(q.question))).toBe(true);
  });

  it("extracts missing-experience review questions from job text", () => {
    const questions = extractQuestions("5+ years experience required. Do you have experience with Kubernetes?");
    expect(questions.some((q) => q.kind === "missing_experience")).toBe(true);
    const drafted = draftAnswers(profile, questions.filter((q) => q.kind === "missing_experience"));
    expect(drafted.every((answer) => answer.answer === "" && answer.requiresReview)).toBe(true);
  });

  it("fills verified notice period and leaves sponsorship for review", () => {
    const answers = draftAnswers(profile, extractQuestions(""));
    const notice = answers.find((a) => a.fieldKey === "notice_period");
    const sponsor = answers.find((a) => a.fieldKey === "sponsorship");
    expect(notice?.requiresReview).toBe(false);
    expect(notice?.answer).toContain("30");
    expect(sponsor?.requiresReview).toBe(true);
    expect(sponsor?.answer).toBe("");
  });

  it("flags unverified salary claims", () => {
    const result = verifyAnswerAgainstProfile(
      { ...profile, expectedSalaryMin: null } as CandidateProfile,
      "salary",
      "$200,000",
    );
    expect(result.ok).toBe(false);
  });

  it("never auto-answers current salary, sponsorship, or relocation", () => {
    const answers = draftAnswers(profile, [
      { fieldKey: "current_salary", question: "What is your current salary?", kind: "current_salary" },
      { fieldKey: "sponsorship", question: "Will you require visa sponsorship now or in the future?", kind: "sponsorship" },
      { fieldKey: "relocation", question: "Are you willing to relocate if required?", kind: "relocation" },
    ]);
    for (const answer of answers) {
      expect(answer.answer).toBe("");
      expect(answer.requiresReview).toBe(true);
    }
    expect(
      verifyAnswerAgainstProfile(profile, "What is your current salary?", "$180,000", "generated").ok,
    ).toBe(false);
    expect(
      verifyAnswerAgainstProfile(profile, "What is your current salary?", "$180,000", "user_input").ok,
    ).toBe(true);
  });
});
