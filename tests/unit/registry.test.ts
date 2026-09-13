import { describe, expect, it } from "vitest";
import { getAdapter, listAdapters, registerAdapter } from "../../src/modules/job-source-adapters/registry.js";
import type { JobSourceAdapter, NormalizedJob } from "../../src/modules/job-source-adapters/types.js";

describe("adapter registry", () => {
  it("exposes the permitted Remotive API and local fixture adapters", () => {
    const names = listAdapters().map((adapter) => adapter.source);
    expect(names).toEqual(expect.arrayContaining(["remotive", "fixture"]));
    expect(getAdapter("fixture")?.supportsApplication()).toBe(false);
  });

  it("registers a new adapter without changing the core job service", async () => {
    const adapter: JobSourceAdapter = {
      source: "phase2-test-source",
      supportsApplication: () => false,
      search: async () =>
        [
          {
            externalId: "p2-1",
            canonicalUrl: "https://example.com/jobs/p2-1",
            title: "Adapter Engineer",
            company: "Registry Co",
            description: "Registered through the adapter interface.",
            source: "phase2-test-source",
          },
        ] satisfies NormalizedJob[],
    };
    registerAdapter(adapter);
    expect(getAdapter("phase2-test-source")).toBe(adapter);
    const jobs = await getAdapter("phase2-test-source")!.search({ keywords: ["adapter"] });
    expect(jobs[0]?.title).toBe("Adapter Engineer");
  });
});
