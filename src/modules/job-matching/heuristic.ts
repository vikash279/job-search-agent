import type { CandidateProfile, Job, JobPreference } from "@prisma/client";
import { matchingThresholds, matchingWeights } from "../../config/matching.js";
import { asStringArray } from "../../lib/json.js";
import type { MatchResult } from "../../ai/schemas.js";

function overlap(left: string[], right: string[]): string[] {
  const set = new Set(left.map((item) => item.toLowerCase()));
  return right.filter((item) => set.has(item.toLowerCase()));
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function heuristicMatch(
  profile: CandidateProfile,
  job: Job,
  preferences: JobPreference,
): MatchResult {
  const profileSkills = asStringArray(profile.skills);
  const jobSkills = asStringArray(job.skills);
  const preferredTech = asStringArray(preferences.preferredTech);
  const required = jobSkills.length ? jobSkills : asStringArray(job.requirements);
  const matchedSkills = overlap(profileSkills, required.length ? required : jobSkills);
  const missingSkills = (required.length ? required : jobSkills).filter(
    (skill) => !matchedSkills.some((m) => m.toLowerCase() === skill.toLowerCase()),
  );

  const skillScore =
    required.length === 0
      ? 60
      : (matchedSkills.length / required.length) * 100;

  const title = `${profile.currentTitle ?? ""} ${asStringArray(profile.preferredRoles).join(" ")}`.toLowerCase();
  const jobTitle = job.title.toLowerCase();
  const roleScore = title && jobTitle.split(/\s+/).some((token) => title.includes(token)) ? 80 : 45;

  const locModes = asStringArray(preferences.workModes);
  let locationScore = 70;
  if (job.workMode && locModes.length) {
    locationScore = locModes.includes(job.workMode) ? 95 : 30;
  } else if (job.workMode === "remote") {
    locationScore = 90;
  }

  let salaryScore = 70;
  if (preferences.salaryMin && job.salaryMax) {
    salaryScore = job.salaryMax >= preferences.salaryMin ? 90 : 20;
  } else if (!job.salaryMin && !job.salaryMax) {
    salaryScore = 55;
  }

  const experienceHay = JSON.stringify(profile.experience ?? []).toLowerCase();
  const expScore = jobSkills.some((skill) => experienceHay.includes(skill.toLowerCase()))
    ? 85
    : profile.yearsExperience && profile.yearsExperience >= 3
      ? 65
      : 40;

  const score = clamp(
    skillScore * matchingWeights.requiredSkills +
      expScore * matchingWeights.relevantExperience +
      roleScore * matchingWeights.roleSeniority +
      locationScore * matchingWeights.locationWorkMode +
      salaryScore * matchingWeights.salaryPreferences,
  );

  const recommendation =
    score >= matchingThresholds.apply ? "apply" : score >= matchingThresholds.review ? "review" : "skip";

  const strengths: string[] = [];
  const concerns: string[] = [];
  if (matchedSkills.length) strengths.push(`Matched skills: ${matchedSkills.join(", ")}`);
  if (job.workMode === "remote") strengths.push("Remote-friendly role");
  if (missingSkills.length) concerns.push(`Missing skills: ${missingSkills.join(", ")}`);
  if (!job.salaryMin) concerns.push("Salary is unknown");
  if (preferredTech.length && !overlap(preferredTech, jobSkills).length) {
    concerns.push("Limited overlap with preferred technologies");
  }

  return {
    score,
    recommendation,
    matchedSkills,
    missingSkills,
    strengths,
    concerns,
    explanation: `Score ${score}/100 using configurable weights (skills ${matchingWeights.requiredSkills}, experience ${matchingWeights.relevantExperience}, role ${matchingWeights.roleSeniority}, location ${matchingWeights.locationWorkMode}, salary ${matchingWeights.salaryPreferences}). ${matchedSkills.length} of ${required.length || jobSkills.length} listed skills overlap. Unknown facts were not invented.`,
  };
}
