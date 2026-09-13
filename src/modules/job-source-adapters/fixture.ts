import { normalizeJob } from "./normalize.js";
import type { JobSearchParams, JobSourceAdapter, NormalizedJob } from "./types.js";

export const FIXTURE_JOBS: NormalizedJob[] = [
  normalizeJob({
    externalId: "fix-001",
    canonicalUrl: "https://jobs.example.com/senior-typescript-engineer",
    title: "Senior TypeScript Engineer",
    company: "Northwind Labs",
    location: "Remote - USA",
    workMode: "remote",
    employmentType: "full_time",
    salaryMin: 140000,
    salaryMax: 180000,
    salaryCurrency: "USD",
    description:
      "We need a senior TypeScript engineer with React, Node.js, PostgreSQL, and AWS. 5+ years experience required. Remote-first team.",
    requirements: ["5+ years TypeScript", "React", "Node.js", "PostgreSQL"],
    skills: ["typescript", "react", "node", "postgresql", "aws"],
    postedAt: new Date(),
    source: "fixture",
  }),
  normalizeJob({
    externalId: "fix-002",
    canonicalUrl: "https://jobs.example.com/python-data-engineer?utm_source=board",
    title: "Python Data Engineer",
    company: "Contoso Analytics",
    location: "London, UK",
    workMode: "hybrid",
    employmentType: "full_time",
    salaryMin: 80000,
    salaryMax: 110000,
    salaryCurrency: "GBP",
    description:
      "Build data pipelines in Python, SQL, and AWS. Airflow experience preferred. Hybrid in London.",
    requirements: ["Python", "SQL", "AWS"],
    skills: ["python", "sql", "aws"],
    postedAt: new Date(),
    source: "fixture",
  }),
  normalizeJob({
    externalId: "fix-003",
    canonicalUrl: "https://jobs.example.com/staff-android-engineer",
    title: "Staff Android Engineer",
    company: "MobileForge",
    location: "Berlin, Germany",
    workMode: "onsite",
    employmentType: "full_time",
    description: "Kotlin and Jetpack Compose. Onsite only. Must have Android shipping experience.",
    requirements: ["Kotlin", "Android"],
    skills: ["kotlin", "android"],
    postedAt: new Date(),
    source: "fixture",
  }),
];

export class FixtureAdapter implements JobSourceAdapter {
  readonly source = "fixture";

  supportsApplication(): boolean {
    return false;
  }

  async search(params: JobSearchParams): Promise<NormalizedJob[]> {
    const keywords = params.keywords.map((k) => k.toLowerCase());
    return FIXTURE_JOBS.filter((job) => {
      const hay = `${job.title} ${job.description} ${(job.skills ?? []).join(" ")}`.toLowerCase();
      const keywordOk = keywords.length === 0 || keywords.some((k) => hay.includes(k));
      const remoteOk = !params.remoteOnly || job.workMode === "remote";
      return keywordOk && remoteOk;
    });
  }

  async getJob(externalId: string): Promise<NormalizedJob | null> {
    return FIXTURE_JOBS.find((job) => job.externalId === externalId) ?? null;
  }
}
