import { describe, expect, it } from "vitest";
import { extractSkills, inferWorkMode, normalizeJob } from "../../src/modules/job-source-adapters/normalize.js";

describe("job normalization", () => {
  it("infers remote work mode and skills", () => {
    const job = normalizeJob({
      canonicalUrl: "https://Example.com/jobs/1?utm_campaign=x",
      title: "  React Engineer ",
      company: " Acme ",
      description: "Remote TypeScript and React role. Must have 4 years experience.",
      source: "fixture",
    });
    expect(job.workMode).toBe("remote");
    expect(job.skills).toEqual(expect.arrayContaining(["typescript", "react"]));
    expect(job.canonicalUrl.startsWith("https://example.com")).toBe(true);
    expect(job.requirements?.length).toBeGreaterThan(0);
  });

  it("extracts known skills only", () => {
    expect(extractSkills("Need COBOL and React")).toEqual(["react"]);
  });

  it("infers hybrid from location text", () => {
    expect(inferWorkMode("office days", "Hybrid - NYC")).toBe("hybrid");
  });
});
