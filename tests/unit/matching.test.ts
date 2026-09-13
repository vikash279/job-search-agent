import { describe, expect, it } from "vitest";
import { matchResultSchema } from "../../src/ai/schemas.js";
import { deterministicFilter } from "../../src/modules/job-matching/filter.js";
import { heuristicMatch } from "../../src/modules/job-matching/heuristic.js";
import type { CandidateProfile, Job, JobPreference } from "@prisma/client";

const profile = {
  skills: ["TypeScript", "React", "Node"],
  currentTitle: "Senior TypeScript Engineer",
  yearsExperience: 8,
  experience: [{ title: "Engineer", company: "Acme", highlights: ["TypeScript"] }],
  preferredRoles: ["TypeScript Engineer"],
} as unknown as CandidateProfile;

const preferences = {
  targetRoles: ["TypeScript Engineer"],
  preferredLocations: ["Remote"],
  workModes: ["remote"],
  preferredTech: ["TypeScript"],
  excludedCompanies: ["BlockedCo"],
  excludedKeywords: ["unpaid"],
  salaryMin: 120000,
} as unknown as JobPreference;

const job = {
  status: "active",
  expiresAt: null,
  company: "Northwind Labs",
  title: "Senior TypeScript Engineer",
  location: "Remote - USA",
  workMode: "remote",
  description: "TypeScript React Node AWS",
  skills: ["typescript", "react", "node"],
  requirements: ["TypeScript"],
  salaryMin: 140000,
  salaryMax: 180000,
} as unknown as Job;

describe("matching", () => {
  it("filters excluded companies and low salary", () => {
    const blocked = deterministicFilter({ ...job, company: "BlockedCo" } as Job, preferences);
    expect(blocked.pass).toBe(false);
    const cheap = deterministicFilter({ ...job, salaryMax: 20000 } as Job, preferences);
    expect(cheap.pass).toBe(false);
  });

  it("scores an aligned role above the review threshold", () => {
    const result = heuristicMatch(profile, job, preferences);
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.matchedSkills.length).toBeGreaterThan(0);
    expect(matchResultSchema.parse(result).recommendation).toMatch(/apply|review|skip/);
  });

  it("does not invent missing skills as matched", () => {
    const result = heuristicMatch(profile, { ...job, skills: ["cobol"] } as Job, preferences);
    expect(result.matchedSkills).not.toContain("cobol");
    expect(result.missingSkills.map((s) => s.toLowerCase())).toContain("cobol");
  });
});
