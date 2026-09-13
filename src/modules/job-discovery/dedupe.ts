import { canonicalizeUrl } from "../../lib/urls.js";
import type { NormalizedJob } from "../job-source-adapters/types.js";

export function jobIdentityKey(job: Pick<NormalizedJob, "source" | "externalId" | "canonicalUrl">): string {
  if (job.externalId) return `${job.source}:${job.externalId}`;
  return `url:${canonicalizeUrl(job.canonicalUrl)}`;
}

export function dedupeNormalized(jobs: NormalizedJob[]): NormalizedJob[] {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const result: NormalizedJob[] = [];
  for (const job of jobs) {
    const id = jobIdentityKey(job);
    const url = canonicalizeUrl(job.canonicalUrl);
    if (seenIds.has(id) || seenUrls.has(url)) continue;
    seenIds.add(id);
    seenUrls.add(url);
    result.push(job);
  }
  return result;
}

export function isLikelyDuplicate(
  a: Pick<NormalizedJob, "title" | "company" | "canonicalUrl">,
  b: Pick<NormalizedJob, "title" | "company" | "canonicalUrl">,
): boolean {
  if (canonicalizeUrl(a.canonicalUrl) === canonicalizeUrl(b.canonicalUrl)) return true;
  return (
    a.company.trim().toLowerCase() === b.company.trim().toLowerCase() &&
    a.title.trim().toLowerCase() === b.title.trim().toLowerCase()
  );
}
