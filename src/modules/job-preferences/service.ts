import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { asOptionalJson } from "../../lib/http.js";
import { asStringArray } from "../../lib/json.js";
import { writeAudit } from "../audit/service.js";

const stringList = z.array(z.string().min(1)).max(50);

export const updatePreferencesSchema = z.object({
  targetRoles: stringList.optional(),
  preferredLocations: stringList.optional(),
  workModes: z.array(z.enum(["remote", "hybrid", "onsite"])).optional(),
  preferredTech: stringList.optional(),
  salaryMin: z.number().int().optional().nullable(),
  salaryMax: z.number().int().optional().nullable(),
  salaryCurrency: z.string().max(8).optional().nullable(),
  noticePeriodDays: z.number().int().min(0).max(365).optional().nullable(),
  minimumMatchScore: z.number().int().min(0).max(100).optional(),
  excludedCompanies: stringList.optional(),
  excludedKeywords: stringList.optional(),
  searchKeywords: stringList.optional(),
  autoSearchEnabled: z.boolean().optional(),
}).superRefine((value, ctx) => {
  if (value.salaryMin != null && value.salaryMax != null && value.salaryMax < value.salaryMin) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["salaryMax"],
      message: "Maximum salary must be greater than or equal to minimum salary",
    });
  }
});

export const searchPreviewSchema = z.object({
  extraKeywords: z.array(z.string()).optional(),
});

export async function getOrCreatePreferences(userId: string) {
  const existing = await prisma.jobPreference.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.jobPreference.create({ data: { userId } });
}

export function serializePreferences(pref: Awaited<ReturnType<typeof getOrCreatePreferences>>) {
  return {
    ...pref,
    targetRoles: asStringArray(pref.targetRoles),
    preferredLocations: asStringArray(pref.preferredLocations),
    workModes: asStringArray(pref.workModes),
    preferredTech: asStringArray(pref.preferredTech),
    excludedCompanies: asStringArray(pref.excludedCompanies),
    excludedKeywords: asStringArray(pref.excludedKeywords),
    searchKeywords: asStringArray(pref.searchKeywords),
  };
}

export async function updatePreferences(userId: string, input: z.infer<typeof updatePreferencesSchema>) {
  await getOrCreatePreferences(userId);
  const updated = await prisma.jobPreference.update({
    where: { userId },
    data: {
      targetRoles: asOptionalJson(input.targetRoles),
      preferredLocations: asOptionalJson(input.preferredLocations),
      workModes: asOptionalJson(input.workModes),
      preferredTech: asOptionalJson(input.preferredTech),
      salaryMin: input.salaryMin,
      salaryMax: input.salaryMax,
      salaryCurrency: input.salaryCurrency,
      noticePeriodDays: input.noticePeriodDays,
      minimumMatchScore: input.minimumMatchScore,
      excludedCompanies: asOptionalJson(input.excludedCompanies),
      excludedKeywords: asOptionalJson(input.excludedKeywords),
      searchKeywords: asOptionalJson(input.searchKeywords),
      autoSearchEnabled: input.autoSearchEnabled,
    },
  });
  await writeAudit({
    userId,
    action: "preferences.update",
    entity: "JobPreference",
    entityId: updated.id,
  });
  return serializePreferences(updated);
}

export async function previewSearch(userId: string, extraKeywords: string[] = []) {
  const pref = serializePreferences(await getOrCreatePreferences(userId));
  const keywords = [...pref.searchKeywords, ...pref.targetRoles, ...pref.preferredTech, ...extraKeywords];
  return {
    keywords: [...new Set(keywords.map((k) => k.trim()).filter(Boolean))],
    locations: pref.preferredLocations,
    workModes: pref.workModes,
    remoteOnly: pref.workModes.length === 1 && pref.workModes[0] === "remote",
    minimumMatchScore: pref.minimumMatchScore,
    excludedCompanies: pref.excludedCompanies,
    excludedKeywords: pref.excludedKeywords,
  };
}
