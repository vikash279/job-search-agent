import { afterEach, describe, expect, it, vi } from "vitest";
import { RemotiveAdapter } from "../../src/modules/job-source-adapters/remotive.js";

describe("Remotive public API adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps JSON API results and ignores tracking params", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          jobs: [
            {
              id: 99,
              url: "https://remotive.com/remote-jobs/software/99?utm_source=board",
              title: "Remote TypeScript Developer",
              company_name: "Permitted API Co",
              candidate_required_location: "Worldwide",
              job_type: "full_time",
              description: "TypeScript and React. Remote.",
              publication_date: "2026-09-01T00:00:00Z",
              tags: ["typescript", "react"],
              salary: "$120,000 - $150,000",
            },
          ],
        }),
      }),
    );

    const jobs = await new RemotiveAdapter().search({ keywords: ["typescript"] });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.source).toBe("remotive");
    expect(jobs[0]?.canonicalUrl).not.toContain("utm_source");
    expect(jobs[0]?.workMode).toBe("remote");
    expect(jobs[0]?.salaryMin).toBe(120000);
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({ href: expect.stringContaining("remotive.com/api/remote-jobs") }),
      expect.objectContaining({ headers: expect.objectContaining({ Accept: "application/json" }) }),
    );
  });
});
