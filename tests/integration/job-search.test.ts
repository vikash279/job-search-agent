import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { persistJobs } from "../../src/modules/job-discovery/service.js";
import { prisma } from "../../src/db/prisma.js";
import { resetDb } from "../helpers.js";

const app = createApp();

describe("job search APIs", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("requires auth, searches the fixture adapter, lists and scores jobs", async () => {
    expect((await request(app).post("/api/v1/jobs/search").send({})).status).toBe(401);

    const auth = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "search@example.com", name: "Search", password: "password12" });
    const headers = { Authorization: `Bearer ${auth.body.token}` };

    await request(app)
      .put("/api/v1/preferences")
      .set(headers)
      .send({
        targetRoles: ["TypeScript Engineer"],
        workModes: ["remote", "hybrid"],
        searchKeywords: ["typescript"],
        excludedCompanies: ["MobileForge"],
      })
      .expect(200);

    const sources = await request(app).get("/api/v1/jobs/sources").set(headers).expect(200);
    expect(sources.body.sources.map((s: { name: string }) => s.name)).toEqual(
      expect.arrayContaining(["fixture", "remotive"]),
    );

    const search = await request(app)
      .post("/api/v1/jobs/search")
      .set(headers)
      .send({ source: "fixture", keywords: ["typescript"] })
      .expect(200);
    expect(search.body.queued).toBe(false);
    expect(search.body.count).toBeGreaterThan(0);

    const listed = await request(app).get("/api/v1/jobs").set(headers).expect(200);
    expect(listed.body.items.some((job: { company: string }) => job.company === "MobileForge")).toBe(false);

    const job = listed.body.items.find((item: { title: string }) => item.title.includes("TypeScript"));
    expect(job).toBeTruthy();

    const match = await request(app).post(`/api/v1/jobs/${job.id}/match`).set(headers).expect(200);
    expect(match.body.match.score).toBeGreaterThanOrEqual(0);
    expect(match.body.match.explanation).toBeTruthy();
    expect(match.body.match.modelVersion).toBeTruthy();

    await request(app).post(`/api/v1/jobs/${job.id}/save`).set(headers).expect(204);
    const saved = await request(app).get("/api/v1/jobs?saved=true").set(headers).expect(200);
    expect(saved.body.items.some((item: { id: string }) => item.id === job.id)).toBe(true);
  });

  it("deduplicates the same canonical URL across sources", async () => {
    await persistJobs([
      {
        externalId: "a-1",
        canonicalUrl: "https://jobs.example.com/shared-role?utm_source=one",
        title: "Shared Role",
        company: "Dup Co",
        description: "TypeScript",
        source: "fixture",
      },
      {
        externalId: "b-1",
        canonicalUrl: "https://jobs.example.com/shared-role",
        title: "Shared Role",
        company: "Dup Co",
        description: "TypeScript",
        source: "fixture",
      },
    ]);
    expect(await prisma.job.count({ where: { title: "Shared Role" } })).toBe(1);
  });
});
