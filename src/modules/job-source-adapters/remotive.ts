import { canonicalizeUrl } from "../../lib/urls.js";
import { normalizeJob } from "./normalize.js";
import type { JobSearchParams, JobSourceAdapter, NormalizedJob } from "./types.js";

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  candidate_required_location?: string;
  job_type?: string;
  description?: string;
  publication_date?: string;
  tags?: string[];
  salary?: string;
}

function parseSalary(salary?: string): { min?: number; max?: number; currency?: string } {
  if (!salary) return {};
  const numbers = [...salary.matchAll(/(\d[\d,]*)/g)].map((m) => Number(m[1]?.replace(/,/g, "")));
  const currency = salary.includes("€") ? "EUR" : salary.includes("£") ? "GBP" : "USD";
  if (numbers.length >= 2) return { min: numbers[0], max: numbers[1], currency };
  if (numbers.length === 1) return { min: numbers[0], currency };
  return {};
}

export class RemotiveAdapter implements JobSourceAdapter {
  readonly source = "remotive";

  supportsApplication(): boolean {
    return false;
  }

  async search(params: JobSearchParams): Promise<NormalizedJob[]> {
    const query = params.keywords.join(" ").trim() || "software";
    const url = new URL("https://remotive.com/api/remote-jobs");
    url.searchParams.set("search", query);
    url.searchParams.set("limit", "50");

    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "job-search-agent/1.0" },
    });
    if (!response.ok) {
      throw new Error(`Remotive search failed with ${response.status}`);
    }
    const data = (await response.json()) as { jobs?: RemotiveJob[] };
    const page = params.page && params.page > 1 ? params.page : 1;
    const start = (page - 1) * 20;
    return (data.jobs ?? [])
      .slice(start, start + 20)
      .map((job) => this.toNormalized(job))
      .filter((job) => this.matchesFilters(job, params));
  }

  private matchesFilters(job: NormalizedJob, params: JobSearchParams): boolean {
    if (params.remoteOnly && job.workMode !== "remote") return false;
    if (params.locations?.length) {
      const loc = (job.location ?? "").toLowerCase();
      const worldwide = /worldwide|anywhere|remote/i.test(loc);
      if (!worldwide && !params.locations.some((item) => loc.includes(item.toLowerCase()))) {
        return false;
      }
    }
    if (params.postedWithinDays && job.postedAt) {
      const cutoff = Date.now() - params.postedWithinDays * 86_400_000;
      if (job.postedAt.getTime() < cutoff) return false;
    }
    return true;
  }

  private toNormalized(job: RemotiveJob): NormalizedJob {
    const salary = parseSalary(job.salary);
    return normalizeJob({
      externalId: String(job.id),
      canonicalUrl: canonicalizeUrl(job.url),
      title: job.title,
      company: job.company_name,
      location: job.candidate_required_location || "Remote",
      workMode: "remote",
      employmentType: job.job_type,
      salaryMin: salary.min,
      salaryMax: salary.max,
      salaryCurrency: salary.currency,
      description: job.description || "",
      skills: job.tags,
      postedAt: job.publication_date ? new Date(job.publication_date) : undefined,
      source: this.source,
      raw: { id: job.id, url: job.url },
    });
  }
}
