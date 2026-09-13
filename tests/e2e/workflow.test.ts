import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { resetDb, seedJobs } from "../helpers.js";

const app = createApp();

describe("e2e copilot workflow", () => {
  beforeEach(async () => {
    await resetDb();
    await seedJobs();
  });

  it("covers search, match, prepare, approve, and user-action states", async () => {
    const auth = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "flow@example.com", name: "Flow", password: "password12" });
    const token = auth.body.token as string;
    const headers = { Authorization: `Bearer ${token}` };

    await request(app)
      .patch("/api/v1/profile")
      .set(headers)
      .send({
        headline: "Senior TypeScript Engineer",
        skills: ["TypeScript", "React", "Node", "PostgreSQL", "AWS"],
        noticePeriodDays: 30,
      })
      .expect(200);

    await request(app)
      .put("/api/v1/preferences")
      .set(headers)
      .send({
        targetRoles: ["TypeScript Engineer"],
        workModes: ["remote", "hybrid"],
        searchKeywords: ["typescript"],
      })
      .expect(200);

    const search = await request(app)
      .post("/api/v1/jobs/search")
      .set(headers)
      .send({ source: "fixture", keywords: ["typescript"] })
      .expect(200);
    expect(search.body.count).toBeGreaterThan(0);

    const listed = await request(app).get("/api/v1/jobs").set(headers).expect(200);
    const job = listed.body.items.find((item: { title: string }) => item.title.includes("TypeScript"));
    expect(job).toBeTruthy();

    const match = await request(app).post(`/api/v1/jobs/${job.id}/match`).set(headers).expect(200);
    expect(match.body.match.explanation).toBeTruthy();

    const prepared = await request(app)
      .post("/api/v1/applications/prepare")
      .set(headers)
      .send({ jobId: job.id })
      .expect(201);
    expect(prepared.body.application.status).toBe("PENDING_APPROVAL");

    const applicationId = prepared.body.application.id as string;
    const answers = (prepared.body.application.answers as Array<{
      id: string;
      fieldKey: string;
      question: string;
      requiresReview: boolean;
    }>).map((answer) => ({
      id: answer.id,
      fieldKey: answer.fieldKey,
      question: answer.question,
      answer: "Reviewed and confirmed by the candidate.",
      source: "user_input" as const,
      requiresReview: false,
    }));

    await request(app)
      .patch(`/api/v1/applications/${applicationId}`)
      .set(headers)
      .send({ answers })
      .expect(200);

    await request(app).post(`/api/v1/applications/${applicationId}/approve`).set(headers).expect(200);
    const started = await request(app)
      .post(`/api/v1/applications/${applicationId}/start`)
      .set(headers)
      .expect(200);
    expect(started.body.execution.status).toBe("REQUIRES_USER_ACTION");

    const tracking = await request(app).get("/api/v1/tracking/summary").set(headers).expect(200);
    expect(tracking.body.counts.REQUIRES_USER_ACTION).toBe(1);

    const events = await request(app)
      .get(`/api/v1/applications/${applicationId}/events`)
      .set(headers)
      .expect(200);
    expect(events.body.events.length).toBeGreaterThan(0);
  });
});
