import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";
import { resetDb, seedJobs } from "../helpers.js";
import { ensureDefaultSources } from "../../src/modules/job-source-adapters/registry.js";

const app = createApp();

async function prepareApproved(headers: Record<string, string>, jobId: string) {
  const prepared = await request(app)
    .post("/api/v1/applications/prepare")
    .set(headers)
    .send({ jobId })
    .expect(201);

  const answers = prepared.body.application.answers.map((answer: {
    fieldKey: string;
    question: string;
    answer: string;
  }) => ({
    fieldKey: answer.fieldKey,
    question: answer.question,
    answer: answer.answer || "Confirmed by the candidate during review.",
    source: "user_input",
    requiresReview: false,
  }));

  await request(app)
    .patch(`/api/v1/applications/${prepared.body.application.id}`)
    .set(headers)
    .send({ answers })
    .expect(200);

  await request(app)
    .post(`/api/v1/applications/${prepared.body.application.id}/approve`)
    .set(headers)
    .expect(200);

  return prepared.body.application.id as string;
}

describe("application execution", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("validates approval, pauses on human gates, continues, and only submits after the user confirms", async () => {
    const auth = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "exec@example.com", name: "Exec", password: "password12" });
    const headers = { Authorization: `Bearer ${auth.body.token}` };

    await request(app)
      .patch("/api/v1/profile")
      .set(headers)
      .send({
        headline: "Senior TypeScript Engineer",
        skills: ["TypeScript", "React"],
        noticePeriodDays: 30,
      })
      .expect(200);

    const jobs = await seedJobs();
    const job = jobs.find((item) => item.title.includes("TypeScript"));
    expect(job).toBeTruthy();

    const blocked = await request(app)
      .post("/api/v1/applications/prepare")
      .set(headers)
      .send({ jobId: job!.id })
      .expect(201);
    const startTooSoon = await request(app)
      .post(`/api/v1/applications/${blocked.body.application.id}/start`)
      .set(headers);
    expect(startTooSoon.status).toBe(403);

    const answers = blocked.body.application.answers.map((answer: {
      fieldKey: string;
      question: string;
      answer: string;
    }) => ({
      fieldKey: answer.fieldKey,
      question: answer.question,
      answer: answer.answer || "Confirmed by the candidate during review.",
      source: "user_input",
      requiresReview: false,
    }));
    await request(app)
      .patch(`/api/v1/applications/${blocked.body.application.id}`)
      .set(headers)
      .send({ answers })
      .expect(200);
    await request(app)
      .post(`/api/v1/applications/${blocked.body.application.id}/approve`)
      .set(headers)
      .expect(200);

    const started = await request(app)
      .post(`/api/v1/applications/${blocked.body.application.id}/start`)
      .set(headers)
      .expect(200);

    expect(started.body.execution.status).toBe("REQUIRES_USER_ACTION");
    expect(started.body.execution.testedAgainstPortal).toBe(false);
    expect(started.body.execution.checkpoints.some((item: { reason: string }) => item.reason === "captcha")).toBe(true);
    expect(started.body.execution.mappedFields.every((field: { value?: unknown }) => field.value == null)).toBe(true);
    expect(started.body.execution).not.toHaveProperty("password");
    expect(started.body.execution).not.toHaveProperty("otp");
    expect(started.body.execution).not.toHaveProperty("cookie");
    expect(started.body.execution).not.toHaveProperty("token");

    const continued = await request(app)
      .post(`/api/v1/applications/${blocked.body.application.id}/continue`)
      .set(headers)
      .send({ completedCheckpoints: ["login", "captcha"] })
      .expect(200);
    expect(continued.body.execution.status).toBe("READY_FOR_SUBMISSION");

    const confirmed = await request(app)
      .post(`/api/v1/applications/${blocked.body.application.id}/confirm-submit`)
      .set(headers)
      .send({ applicationUrl: job!.canonicalUrl })
      .expect(200);
    expect(confirmed.body.application.status).toBe("SUBMITTED");

    const restart = await request(app)
      .post(`/api/v1/applications/${blocked.body.application.id}/start`)
      .set(headers);
    expect(restart.status).toBe(403);

    const events = await request(app)
      .get(`/api/v1/applications/${blocked.body.application.id}/events`)
      .set(headers)
      .expect(200);
    expect(events.body.events.some((event: { eventType: string }) => event.eventType === "execution.started")).toBe(true);
    expect(events.body.events.some((event: { eventType: string }) => event.eventType === "execution.submitted")).toBe(true);
    for (const event of events.body.events as Array<{ metadata?: Record<string, unknown> }>) {
      expect(event.metadata ?? {}).not.toHaveProperty("password");
      expect(event.metadata ?? {}).not.toHaveProperty("otp");
      expect(event.metadata ?? {}).not.toHaveProperty("cookie");
      expect(event.metadata ?? {}).not.toHaveProperty("token");
    }

    const audits = await prisma.auditLog.findMany({
      where: { entityId: blocked.body.application.id, action: { startsWith: "application.execution" } },
    });
    expect(audits.length).toBeGreaterThan(0);
  });

  it("uses the assisted URL adapter when no portal integration exists", async () => {
    const auth = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "remote-exec@example.com", name: "Remote", password: "password12" });
    const headers = { Authorization: `Bearer ${auth.body.token}` };
    await request(app)
      .patch("/api/v1/profile")
      .set(headers)
      .send({ headline: "Engineer", skills: ["TypeScript"], noticePeriodDays: 15 })
      .expect(200);

    await ensureDefaultSources();
    const remotive = await prisma.jobSource.findUniqueOrThrow({ where: { name: "remotive" } });
    const job = await prisma.job.create({
      data: {
        sourceId: remotive.id,
        externalId: "rem-exec-1",
        canonicalUrl: "https://remotive.com/remote-jobs/software-dev/example",
        title: "Remote Engineer",
        company: "Example Remote",
        description: "A remote role from a public listing.",
      },
    });

    const applicationId = await prepareApproved(headers, job.id);
    const started = await request(app)
      .post(`/api/v1/applications/${applicationId}/start`)
      .set(headers)
      .expect(200);
    expect(started.body.execution.adapter).toBe("assisted");
    expect(started.body.execution.status).toBe("REQUIRES_USER_ACTION");
    expect(started.body.execution.testedAgainstPortal).toBe(false);
    expect(started.body.execution.applicationUrl).toContain("remotive.com");

    await request(app)
      .post(`/api/v1/applications/${applicationId}/status`)
      .set(headers)
      .send({ status: "FAILED", errorMessage: "User closed the employer tab" })
      .expect(200);

    const retried = await request(app)
      .post(`/api/v1/applications/${applicationId}/retry`)
      .set(headers)
      .expect(200);
    expect(retried.body.execution.status).toBe("REQUIRES_USER_ACTION");
    expect(retried.body.execution.retryable).toBe(true);
  });
});
