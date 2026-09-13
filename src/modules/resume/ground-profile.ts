import type { ParsedProfile } from "../../ai/schemas.js";
import { parsedProfileSchema } from "../../ai/schemas.js";

function appearsIn(source: string, value?: string): boolean {
  const needle = value?.trim().toLowerCase();
  if (!needle) return false;
  return source.toLowerCase().includes(needle);
}

function salaryMentioned(source: string): boolean {
  return /salary|compensation|ctc|\$|usd|eur|gbp|lpa/i.test(source);
}

function noticeMentioned(source: string): boolean {
  return /notice period|available immediately|joining/i.test(source);
}

export function groundParsedProfile(sourceText: string, parsed: ParsedProfile): ParsedProfile {
  const grounded: ParsedProfile = {
    ...parsed,
    skills: parsed.skills.filter((skill) => appearsIn(sourceText, skill)),
    certifications: parsed.certifications.filter((item) => appearsIn(sourceText, item)),
    achievements: parsed.achievements.filter((item) => appearsIn(sourceText, item)),
    preferredRoles: parsed.preferredRoles.filter((item) => appearsIn(sourceText, item)),
    preferredLocations: parsed.preferredLocations.filter((item) => appearsIn(sourceText, item)),
    experience: parsed.experience
      .filter((item) => appearsIn(sourceText, item.title) || appearsIn(sourceText, item.company))
      .map((item) => ({
        ...item,
        company: appearsIn(sourceText, item.company) ? item.company : "",
        highlights: item.highlights.filter((line) => appearsIn(sourceText, line)),
      })),
    education: parsed.education.filter((item) => appearsIn(sourceText, item.school)),
    projects: parsed.projects.filter((item) => appearsIn(sourceText, item.name)),
    headline: appearsIn(sourceText, parsed.headline) ? parsed.headline : undefined,
    summary: parsed.summary && sourceText.toLowerCase().includes(parsed.summary.slice(0, 40).toLowerCase())
      ? parsed.summary
      : parsed.summary && appearsIn(sourceText, parsed.summary.split(/\s+/).slice(0, 6).join(" "))
        ? parsed.summary
        : undefined,
    currentTitle: appearsIn(sourceText, parsed.currentTitle) ? parsed.currentTitle : undefined,
    currentCompany: appearsIn(sourceText, parsed.currentCompany) ? parsed.currentCompany : undefined,
    yearsExperience: parsed.yearsExperience != null && /\d+\+?\s+years?/i.test(sourceText)
      ? parsed.yearsExperience
      : undefined,
    noticePeriodDays: parsed.noticePeriodDays != null && noticeMentioned(sourceText)
      ? parsed.noticePeriodDays
      : undefined,
    expectedSalaryMin: parsed.expectedSalaryMin != null && salaryMentioned(sourceText)
      ? parsed.expectedSalaryMin
      : undefined,
    expectedSalaryMax: parsed.expectedSalaryMax != null && salaryMentioned(sourceText)
      ? parsed.expectedSalaryMax
      : undefined,
    salaryCurrency: parsed.salaryCurrency && salaryMentioned(sourceText) ? parsed.salaryCurrency : undefined,
  };

  return parsedProfileSchema.parse(grounded);
}
