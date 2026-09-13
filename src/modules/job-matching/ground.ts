import type { CandidateProfile, Job } from "@prisma/client";
import { matchResultSchema, type MatchResult } from "../../ai/schemas.js";
import { asStringArray, uniqueNormalized } from "../../lib/json.js";

function hasSkill(list: string[], skill: string): boolean {
  const needle = skill.trim().toLowerCase();
  return list.some((item) => item.trim().toLowerCase() === needle);
}

export function groundMatchResult(
  profile: CandidateProfile,
  job: Job,
  result: MatchResult,
): MatchResult {
  const profileSkills = asStringArray(profile.skills);
  const jobSkills = uniqueNormalized([...asStringArray(job.skills), ...asStringArray(job.requirements)]);
  const hay = `${job.title} ${job.description}`.toLowerCase();

  const matchedSkills = uniqueNormalized(
    result.matchedSkills.filter((skill) => hasSkill(profileSkills, skill)),
  );
  const missingSkills = uniqueNormalized(
    result.missingSkills.filter(
      (skill) => hasSkill(jobSkills, skill) || hay.includes(skill.trim().toLowerCase()),
    ),
  ).filter((skill) => !hasSkill(profileSkills, skill));

  return matchResultSchema.parse({
    ...result,
    score: Math.max(0, Math.min(100, Math.round(result.score))),
    matchedSkills,
    missingSkills,
    explanation:
      result.explanation ||
      "Match scored from verified candidate facts only; unknown job details were not treated as candidate experience.",
  });
}
