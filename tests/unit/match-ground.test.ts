import { describe, expect, it } from "vitest";
import { matchResultSchema } from "../../src/ai/schemas.js";
import { groundMatchResult } from "../../src/modules/job-matching/ground.js";
import type { CandidateProfile, Job } from "@prisma/client";

const profile = {
  skills: ["TypeScript", "React"],
} as unknown as CandidateProfile;

const job = {
  title: "TypeScript Engineer",
  description: "Need TypeScript and Kubernetes.",
  skills: ["typescript", "kubernetes"],
  requirements: ["TypeScript"],
} as unknown as Job;

describe("match result grounding", () => {
  it("drops invented candidate skills and keeps structured validation", () => {
    const grounded = groundMatchResult(
      profile,
      job,
      matchResultSchema.parse({
        score: 88,
        recommendation: "apply",
        matchedSkills: ["TypeScript", "COBOL", "React"],
        missingSkills: ["Kubernetes", "Telepathy"],
        strengths: ["TypeScript overlap"],
        concerns: [],
        explanation: "ok",
      }),
    );
    expect(grounded.matchedSkills).toEqual(["TypeScript", "React"]);
    expect(grounded.missingSkills).toEqual(["Kubernetes"]);
    expect(grounded.matchedSkills).not.toContain("COBOL");
  });
});
