import { z } from "zod";
import type { ParsedProfile } from "../../ai/schemas.js";
import { prisma } from "../../db/prisma.js";
import { asJson, asOptionalJson } from "../../lib/http.js";
import { asStringArray } from "../../lib/json.js";
import { NotFoundError } from "../../lib/errors.js";
import { writeAudit } from "../audit/service.js";

const jsonStringArray = z.array(z.string()).optional();

export const updateProfileSchema = z.object({
  headline: z.string().max(200).optional().nullable(),
  summary: z.string().max(4000).optional().nullable(),
  yearsExperience: z.number().min(0).max(60).optional().nullable(),
  currentTitle: z.string().max(160).optional().nullable(),
  currentCompany: z.string().max(160).optional().nullable(),
  skills: jsonStringArray,
  experience: z.array(z.record(z.string(), z.unknown())).optional(),
  education: z.array(z.record(z.string(), z.unknown())).optional(),
  achievements: jsonStringArray,
  certifications: jsonStringArray,
  projects: z.array(z.record(z.string(), z.unknown())).optional(),
  preferredLocations: jsonStringArray,
  preferredRoles: jsonStringArray,
  preferredWorkModes: jsonStringArray,
  noticePeriodDays: z.number().int().min(0).max(365).optional().nullable(),
  expectedSalaryMin: z.number().int().optional().nullable(),
  expectedSalaryMax: z.number().int().optional().nullable(),
  salaryCurrency: z.string().max(8).optional().nullable(),
}).superRefine((value, ctx) => {
  if (
    value.expectedSalaryMin != null &&
    value.expectedSalaryMax != null &&
    value.expectedSalaryMax < value.expectedSalaryMin
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["expectedSalaryMax"],
      message: "Maximum salary must be greater than or equal to minimum salary",
    });
  }
});

export async function getOrCreateProfile(userId: string) {
  const existing = await prisma.candidateProfile.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.candidateProfile.create({ data: { userId } });
}

export function serializeProfile(profile: Awaited<ReturnType<typeof getOrCreateProfile>>) {
  return {
    ...profile,
    skills: asStringArray(profile.skills),
    experience: profile.experience,
    education: profile.education,
    achievements: asStringArray(profile.achievements),
    certifications: asStringArray(profile.certifications),
    projects: profile.projects,
    preferredLocations: asStringArray(profile.preferredLocations),
    preferredRoles: asStringArray(profile.preferredRoles),
    preferredWorkModes: asStringArray(profile.preferredWorkModes),
    verifiedFields: asStringArray(profile.verifiedFields),
  };
}

export async function updateProfile(userId: string, input: z.infer<typeof updateProfileSchema>) {
  const profile = await getOrCreateProfile(userId);
  const verified = new Set(asStringArray(profile.verifiedFields));
  for (const key of Object.keys(input)) verified.add(key);

  const updated = await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      headline: input.headline,
      summary: input.summary,
      yearsExperience: input.yearsExperience,
      currentTitle: input.currentTitle,
      currentCompany: input.currentCompany,
      skills: asOptionalJson(input.skills),
      experience: asOptionalJson(input.experience),
      education: asOptionalJson(input.education),
      achievements: asOptionalJson(input.achievements),
      certifications: asOptionalJson(input.certifications),
      projects: asOptionalJson(input.projects),
      preferredLocations: asOptionalJson(input.preferredLocations),
      preferredRoles: asOptionalJson(input.preferredRoles),
      preferredWorkModes: asOptionalJson(input.preferredWorkModes),
      noticePeriodDays: input.noticePeriodDays,
      expectedSalaryMin: input.expectedSalaryMin,
      expectedSalaryMax: input.expectedSalaryMax,
      salaryCurrency: input.salaryCurrency,
      verifiedFields: asJson([...verified]),
    },
  });
  await writeAudit({
    userId,
    action: "profile.update",
    entity: "CandidateProfile",
    entityId: updated.id,
  });
  return serializeProfile(updated);
}

export async function applyParsedProfile(userId: string, parsed: ParsedProfile) {
  const profile = await getOrCreateProfile(userId);
  const verified = new Set(asStringArray(profile.verifiedFields));
  const keep = (field: string, incoming: unknown, current: unknown) => {
    if (verified.has(field)) return current ?? incoming;
    return incoming ?? current;
  };

  return prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      headline: keep("headline", parsed.headline, profile.headline) as string | null,
      summary: keep("summary", parsed.summary, profile.summary) as string | null,
      yearsExperience: keep("yearsExperience", parsed.yearsExperience, profile.yearsExperience) as number | null,
      currentTitle: keep("currentTitle", parsed.currentTitle, profile.currentTitle) as string | null,
      currentCompany: keep("currentCompany", parsed.currentCompany, profile.currentCompany) as string | null,
      skills: asOptionalJson(keep("skills", parsed.skills, profile.skills)),
      experience: asOptionalJson(keep("experience", parsed.experience, profile.experience)),
      education: asOptionalJson(keep("education", parsed.education, profile.education)),
      achievements: asOptionalJson(keep("achievements", parsed.achievements, profile.achievements)),
      certifications: asOptionalJson(keep("certifications", parsed.certifications, profile.certifications)),
      projects: asOptionalJson(keep("projects", parsed.projects, profile.projects)),
      preferredLocations: asOptionalJson(keep("preferredLocations", parsed.preferredLocations, profile.preferredLocations)),
      preferredRoles: asOptionalJson(keep("preferredRoles", parsed.preferredRoles, profile.preferredRoles)),
      preferredWorkModes: asOptionalJson(keep("preferredWorkModes", parsed.preferredWorkModes, profile.preferredWorkModes)),
      noticePeriodDays: keep("noticePeriodDays", parsed.noticePeriodDays, profile.noticePeriodDays) as number | null,
      expectedSalaryMin: keep("expectedSalaryMin", parsed.expectedSalaryMin, profile.expectedSalaryMin) as number | null,
      expectedSalaryMax: keep("expectedSalaryMax", parsed.expectedSalaryMax, profile.expectedSalaryMax) as number | null,
    },
  });
}

export async function requireProfile(userId: string) {
  const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
  if (!profile) throw new NotFoundError("Candidate profile not found");
  return profile;
}
