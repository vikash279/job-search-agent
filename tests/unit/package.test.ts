import { describe, expect, it } from "vitest";
import type { CandidateProfile } from "@prisma/client";
import { groundApplicationPackage } from "../../src/modules/application-preparation/package.js";

const profile = {
  skills: ["TypeScript"],
  noticePeriodDays: 30,
  expectedSalaryMin: null,
  verifiedFields: ["skills", "noticePeriodDays"],
} as unknown as CandidateProfile;

describe("application package grounding", () => {
  it("clears fabricated salary, sponsorship, and experience answers", () => {
    const grounded = groundApplicationPackage(profile, {
      coverLetter: "I currently earn $180,000 and can start immediately.",
      tailoredResume: "Expert in Kubernetes. Salary $180,000.",
      tailoringNotes: ["Keep verified skills only"],
      answers: [
        {
          fieldKey: "sponsorship",
          question: "Will you require visa sponsorship now or in the future?",
          answer: "No",
          source: "generated",
          confidence: 0.9,
          requiresReview: false,
        },
        {
          fieldKey: "current_salary",
          question: "What is your current salary?",
          answer: "$180,000",
          source: "generated",
          confidence: 0.8,
          requiresReview: false,
        },
        {
          fieldKey: "missing_experience",
          question: "Do you have experience with Kubernetes?",
          answer: "Yes, 10 years",
          source: "generated",
          confidence: 0.7,
          requiresReview: false,
        },
      ],
    });

    expect(grounded.coverLetter).toContain("[salary not verified]");
    expect(grounded.answers.every((answer) => answer.answer === "")).toBe(true);
    expect(grounded.answers.every((answer) => answer.requiresReview)).toBe(true);
  });

  it("keeps user-provided answers during grounding", () => {
    const grounded = groundApplicationPackage(profile, {
      coverLetter: "I am applying with verified TypeScript experience.",
      tailoredResume: "TypeScript",
      tailoringNotes: [],
      answers: [
        {
          fieldKey: "sponsorship",
          question: "Will you require visa sponsorship now or in the future?",
          answer: "Yes, I will need sponsorship.",
          source: "user_input",
          confidence: 1,
          requiresReview: false,
        },
      ],
    });
    expect(grounded.answers[0]?.answer).toContain("sponsorship");
    expect(grounded.answers[0]?.requiresReview).toBe(false);
  });
});
