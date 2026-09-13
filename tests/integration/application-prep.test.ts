import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";
import { resetDb, seedJobs } from "../helpers.js";
import { createDocx } from "../fixtures/docx.js";

const app = createApp();

const CV = `Alex Rivera
Senior TypeScript Engineer
Skills
TypeScript, React, Node
`;

describe("application preparation and approval", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("prepares a reviewable package and blocks approval until sensitive answers are filled", async () => {
    const auth = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "prep@example.com", name: "Prep", password: "password12" });
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

    const prepared = await request(app)
      .post("/api/v1/applications/prepare")
      .set(headers)
      .send({ jobId: job!.id })
      .expect(201);

    expect(prepared.body.application.status).toBe("PENDING_APPROVAL");
    expect(prepared.body.application.coverLetter).toBeTruthy();
    expect(prepared.body.application.tailoredResume).toBeTruthy();
    expect(prepared.body.application.review.originalJobDescription).toContain("TypeScript");
    expect(prepared.body.application.review.canApprove).toBe(false);

    const sponsor = prepared.body.application.answers.find((answer: { fieldKey: string }) => answer.fieldKey === "sponsorship");
    expect(sponsor.requiresReview).toBe(true);
    expect(sponsor.answer).toBe("");

    const blocked = await request(app)
      .post(`/api/v1/applications/${prepared.body.application.id}/approve`)
      .set(headers);
    expect(blocked.status).toBe(400);

    const startBlocked = await request(app)
      .post(`/api/v1/applications/${prepared.body.application.id}/start`)
      .set(headers);
    expect(startBlocked.status).toBe(403);

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

    const approved = await request(app)
      .post(`/api/v1/applications/${prepared.body.application.id}/approve`)
      .set(headers)
      .expect(200);
    expect(approved.body.application.status).toBe("APPROVED");

    const other = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "other-prep@example.com", name: "Other", password: "password12" });
    const stolen = await request(app)
      .get(`/api/v1/applications/${prepared.body.application.id}`)
      .set("Authorization", `Bearer ${other.body.token}`);
    expect(stolen.status).toBe(404);

    await prisma.job.update({
      where: { id: job!.id },
      data: { description: "REPLACED DESCRIPTION" },
    });
    const review = await request(app)
      .get(`/api/v1/applications/${prepared.body.application.id}`)
      .set(headers)
      .expect(200);
    expect(review.body.application.review.originalJobDescription).toContain("TypeScript");
    expect(review.body.application.review.originalJobDescription).not.toContain("REPLACED DESCRIPTION");
  });

  it("selects a resume, stores the original CV snapshot, and supports reject", async () => {
    const auth = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "resume-prep@example.com", name: "Resume", password: "password12" });
    const headers = { Authorization: `Bearer ${auth.body.token}` };

    const uploaded = await request(app)
      .post("/api/v1/profile/parse-resume")
      .set(headers)
      .attach("file", createDocx(CV), "primary.docx")
      .field("name", "TypeScript CV")
      .expect(201);

    const jobs = await seedJobs();
    const job = jobs.find((item) => item.title.includes("TypeScript"));
    expect(job).toBeTruthy();

    const tailored = await request(app)
      .post(`/api/v1/resumes/${uploaded.body.resume.id}/tailor`)
      .set(headers)
      .send({ jobId: job!.id })
      .expect(200);
    expect(tailored.body.tailoredResume).toBeTruthy();
    expect(Array.isArray(tailored.body.tailoringNotes)).toBe(true);

    const prepared = await request(app)
      .post("/api/v1/applications/prepare")
      .set(headers)
      .send({ jobId: job!.id, resumeVersionId: uploaded.body.resume.id })
      .expect(201);

    expect(prepared.body.application.resumeVersionId).toBe(uploaded.body.resume.id);
    expect(prepared.body.application.review.selectedResumeName).toBe("TypeScript CV");
    expect(prepared.body.application.review.originalResumeText).toContain("Alex Rivera");

    const originalText = uploaded.body.resume.parsedText as string;
    await prisma.resumeVersion.update({
      where: { id: uploaded.body.resume.id },
      data: { parsedText: "CHANGED AFTER PREPARE", name: "Renamed later" },
    });
    const review = await request(app)
      .get(`/api/v1/applications/${prepared.body.application.id}`)
      .set(headers)
      .expect(200);
    expect(review.body.application.review.originalResumeText).toContain("Alex Rivera");
    expect(review.body.application.review.originalResumeText).toBe(originalText);
    expect(review.body.application.review.originalResumeText).not.toContain("CHANGED AFTER PREPARE");

    const rejected = await request(app)
      .post(`/api/v1/applications/${prepared.body.application.id}/reject`)
      .set(headers)
      .expect(200);
    expect(rejected.body.application.status).toBe("REJECTED");
  });
});
