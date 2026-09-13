import { describe, expect, it } from "vitest";
import { dedupeNormalized, isLikelyDuplicate } from "../../src/modules/job-discovery/dedupe.js";
import { FIXTURE_JOBS } from "../../src/modules/job-source-adapters/fixture.js";
import { canonicalizeUrl } from "../../src/lib/urls.js";

describe("duplicate detection", () => {
  it("drops jobs with the same source and external id", () => {
    const dup = [...FIXTURE_JOBS, { ...FIXTURE_JOBS[0]! }];
    expect(dedupeNormalized(dup)).toHaveLength(FIXTURE_JOBS.length);
  });

  it("matches company + title even across urls", () => {
    expect(
      isLikelyDuplicate(
        { title: "Senior TypeScript Engineer", company: "Northwind Labs", canonicalUrl: "https://a.example/1" },
        { title: "Senior TypeScript Engineer", company: "Northwind Labs", canonicalUrl: "https://b.example/2" },
      ),
    ).toBe(true);
  });

  it("canonicalizes fixture tracking urls", () => {
    const job = FIXTURE_JOBS.find((item) => item.externalId === "fix-002");
    expect(job?.canonicalUrl).toBe(canonicalizeUrl("https://jobs.example.com/python-data-engineer"));
  });
});
