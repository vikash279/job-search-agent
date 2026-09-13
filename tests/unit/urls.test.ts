import { describe, expect, it } from "vitest";
import { canonicalizeUrl, urlsLikelySame } from "../../src/lib/urls.js";

describe("canonicalizeUrl", () => {
  it("strips tracking params and normalizes host", () => {
    const a = canonicalizeUrl("HTTPS://Jobs.Example.com/role/?utm_source=board&id=3");
    const b = canonicalizeUrl("https://jobs.example.com/role/?id=3");
    expect(a).toBe(b);
  });

  it("treats matching canonical URLs as duplicates", () => {
    expect(
      urlsLikelySame(
        "https://jobs.example.com/python-data-engineer?utm_source=board",
        "https://jobs.example.com/python-data-engineer",
      ),
    ).toBe(true);
  });
});
