import { uniqueNormalized } from "../../lib/json.js";
import type { ParsedProfile } from "../../ai/schemas.js";

const SKILL_LEXICON = [
  "javascript",
  "typescript",
  "python",
  "java",
  "go",
  "rust",
  "php",
  "ruby",
  "c#",
  "c++",
  "sql",
  "postgresql",
  "mysql",
  "mongodb",
  "redis",
  "react",
  "vue",
  "angular",
  "node",
  "express",
  "nestjs",
  "next.js",
  "django",
  "flask",
  "spring",
  "aws",
  "gcp",
  "azure",
  "docker",
  "kubernetes",
  "terraform",
  "graphql",
  "rest",
  "html",
  "css",
  "sass",
  "tailwind",
  "git",
  "linux",
  "ci/cd",
  "prisma",
  "pandas",
  "pytorch",
  "tensorflow",
];

const WORK_MODES = ["remote", "hybrid", "onsite", "on-site"];

function section(text: string, heading: string): string {
  const pattern = new RegExp(
    `${heading}[:\\s]*([\\s\\S]*?)(?=\\n(?:experience|education|skills|projects|certifications|summary|achievements)\\b|$)`,
    "i",
  );
  return text.match(pattern)?.[1]?.trim() ?? "";
}

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function heuristicParseResume(text: string): ParsedProfile {
  const lower = text.toLowerCase();
  const skills = uniqueNormalized(
    SKILL_LEXICON.filter((skill) => lower.includes(skill)).map((skill) =>
      skill === "next.js" ? "Next.js" : skill.replace(/\b\w/g, (c) => c.toUpperCase()),
    ),
  );

  const experienceBlock = section(text, "experience");
  const educationBlock = section(text, "education");
  const summaryBlock = section(text, "summary") || section(text, "profile");

  const experience = lines(experienceBlock)
    .slice(0, 8)
    .map((line) => {
      const [title, company] = line.split(/\s[-–@|]\s/);
      return {
        title: title || line,
        company: company ?? "",
        highlights: [line],
      };
    });

  const education = lines(educationBlock).slice(0, 4).map((line) => ({
    school: line,
  }));

  const yearsMatch = text.match(/(\d{1,2})\+?\s+years?/i);
  const titleLine = lines(text)[1];

  return {
    headline: lines(text)[0]?.slice(0, 160),
    summary: summaryBlock.slice(0, 1200) || undefined,
    yearsExperience: yearsMatch ? Number(yearsMatch[1]) : undefined,
    currentTitle: titleLine?.slice(0, 120),
    skills,
    experience,
    education,
    achievements: lines(section(text, "achievements")).slice(0, 10),
    certifications: lines(section(text, "certifications")).slice(0, 10),
    projects: lines(section(text, "projects")).slice(0, 6).map((name) => ({ name, technologies: [] })),
    preferredRoles: [],
    preferredLocations: [],
    preferredWorkModes: WORK_MODES.filter((mode) => lower.includes(mode)).map((mode) =>
      mode === "on-site" ? "onsite" : mode,
    ),
  };
}
