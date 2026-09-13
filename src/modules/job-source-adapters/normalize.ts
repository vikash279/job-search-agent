import { canonicalizeUrl } from "../../lib/urls.js";
import { uniqueNormalized } from "../../lib/json.js";
import { normalizedJobSchema, type NormalizedJob } from "./types.js";

const SKILL_HINTS = [
  "javascript",
  "typescript",
  "python",
  "java",
  "react",
  "node",
  "aws",
  "sql",
  "docker",
  "kubernetes",
  "go",
  "php",
  "ruby",
  "c#",
  "next.js",
  "graphql",
];

export function inferWorkMode(text: string, location?: string): "remote" | "hybrid" | "onsite" | undefined {
  const hay = `${text} ${location ?? ""}`.toLowerCase();
  if (/\bremote\b/.test(hay)) return "remote";
  if (/\bhybrid\b/.test(hay)) return "hybrid";
  if (/\bonsite\b|\bon-site\b|\bin[- ]office\b/.test(hay)) return "onsite";
  return location ? "onsite" : undefined;
}

export function extractSkills(text: string): string[] {
  const lower = text.toLowerCase();
  return uniqueNormalized(SKILL_HINTS.filter((skill) => lower.includes(skill)));
}

export function extractRequirements(description: string): string[] {
  return description
    .split(/\n|•|\u2022|- /)
    .map((line) => line.trim())
    .filter((line) => /require|must|experience|years|degree/i.test(line))
    .slice(0, 12);
}

const WORK_MODES = new Set(["remote", "hybrid", "onsite"]);

export function normalizeJob(input: NormalizedJob): NormalizedJob {
  const description = input.description?.trim() || "";
  const workMode = input.workMode && WORK_MODES.has(input.workMode)
    ? input.workMode
    : inferWorkMode(description, input.location);
  return normalizedJobSchema.parse({
    ...input,
    canonicalUrl: canonicalizeUrl(input.canonicalUrl),
    title: input.title.trim(),
    company: input.company.trim(),
    location: input.location?.trim(),
    workMode,
    skills: uniqueNormalized([...(input.skills ?? []), ...extractSkills(`${input.title} ${description}`)]),
    requirements: input.requirements?.length ? input.requirements : extractRequirements(description),
    description,
    source: input.source,
  });
}
