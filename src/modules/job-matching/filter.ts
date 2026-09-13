import { asStringArray, includesNormalized } from "../../lib/json.js";
import type { Job, JobPreference } from "@prisma/client";

export interface FilterDecision {
  pass: boolean;
  reasons: string[];
}

function roleRelated(title: string, targetRoles: string[]): boolean {
  if (targetRoles.length === 0) return true;
  const hay = title.toLowerCase();
  return targetRoles.some((role) => {
    const tokens = role.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    return tokens.some((token) => hay.includes(token));
  });
}

export function deterministicFilter(
  job: Job,
  preferences: JobPreference,
): FilterDecision {
  const reasons: string[] = [];
  if (job.status !== "active") reasons.push("Job is not active");
  if (job.expiresAt && job.expiresAt.getTime() < Date.now()) reasons.push("Job has expired");

  const excludedCompanies = asStringArray(preferences.excludedCompanies);
  if (includesNormalized(excludedCompanies, job.company)) {
    reasons.push("Company is excluded");
  }

  const excludedKeywords = asStringArray(preferences.excludedKeywords);
  const hay = `${job.title} ${job.description}`.toLowerCase();
  for (const keyword of excludedKeywords) {
    if (hay.includes(keyword.toLowerCase())) {
      reasons.push(`Excluded keyword: ${keyword}`);
      break;
    }
  }

  const locations = asStringArray(preferences.preferredLocations);
  if (locations.length && job.location) {
    const loc = job.location.toLowerCase();
    const worldwide = /remote|worldwide|anywhere/.test(loc);
    const locationOk = worldwide || locations.some((item) => loc.includes(item.toLowerCase()));
    if (!locationOk && job.workMode !== "remote") reasons.push("Location does not match preferences");
  }

  const modes = asStringArray(preferences.workModes);
  if (modes.length && job.workMode && !modes.includes(job.workMode)) {
    reasons.push("Work mode does not match preferences");
  }

  const roles = asStringArray(preferences.targetRoles);
  if (!roleRelated(job.title, roles)) reasons.push("Role appears unrelated to target titles");

  if (preferences.salaryMin && job.salaryMax && job.salaryMax < preferences.salaryMin) {
    reasons.push("Salary is below the configured minimum");
  }

  return { pass: reasons.length === 0, reasons };
}
