import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";
import { resetDb } from "../helpers.js";
import { createDocx } from "../fixtures/docx.js";

const app = createApp();

const CV = `Alex Rivera
Senior TypeScript Engineer
Summary
Full-stack engineer with 8 years experience in TypeScript and React.
Skills
TypeScript, React, Node, PostgreSQL
Experience
Senior Engineer - Northwind
Education
MIT
`;

describe("resume upload and profile parsing", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("rejects unauthenticated uploads and isolates resume files", async () => {
    const denied = await request(app).post("/api/v1/resumes").attach("file", createDocx(CV), "cv.docx");
    expect(denied.status).toBe(401);

    const owner = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "owner@example.com", name: "Owner", password: "password12" });
    const other = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "other@example.com", name: "Other", password: "password12" });

    const uploaded = await request(app)
      .post("/api/v1/profile/parse-resume")
      .set("Authorization", `Bearer ${owner.body.token}`)
      .attach("file", createDocx(CV), "cv.docx")
      .field("name", "Primary CV");
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.resume.parsedText).toContain("Alex Rivera");
    expect(uploaded.body.resume.fileKey).toBeTruthy();
    expect(uploaded.body.profile.headline).toBeTruthy();

    const stolen = await request(app)
      .get(`/api/v1/resumes/${uploaded.body.resume.id}`)
      .set("Authorization", `Bearer ${other.body.token}`);
    expect(stolen.status).toBe(404);

    const stolenFile = await request(app)
      .get(`/api/v1/files/${encodeURIComponent(uploaded.body.resume.fileKey)}`)
      .set("Authorization", `Bearer ${other.body.token}`);
    expect(stolenFile.status).toBe(403);

    const ownFile = await request(app)
      .get(`/api/v1/resumes/${uploaded.body.resume.id}/file`)
      .set("Authorization", `Bearer ${owner.body.token}`);
    expect(ownFile.status).toBe(200);

    const stored = await prisma.resumeVersion.findUnique({
      where: { id: uploaded.body.resume.id },
    });
    expect(stored?.fileKey).toBe(uploaded.body.resume.fileKey);
    expect(stored?.parsedText).toBeTruthy();
  });

  it("keeps the original file when the user edits the extracted profile", async () => {
    const auth = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "edit@example.com", name: "Edit", password: "password12" });
    const token = auth.body.token as string;

    const parsed = await request(app)
      .post("/api/v1/profile/parse-resume")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", createDocx(CV), "original.docx");
    const fileKey = parsed.body.resume.fileKey as string;

    await request(app)
      .patch("/api/v1/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({ headline: "Edited headline", skills: ["TypeScript"] })
      .expect(200);

    const after = await request(app).get("/api/v1/profile").set("Authorization", `Bearer ${token}`);
    expect(after.body.profile.headline).toBe("Edited headline");
    expect(after.body.profile.verifiedFields).toEqual(expect.arrayContaining(["headline", "skills"]));

    const resume = await prisma.resumeVersion.findUnique({ where: { id: parsed.body.resume.id } });
    expect(resume?.fileKey).toBe(fileKey);
    expect(resume?.parsedProfile).toBeTruthy();
  });

  it("rejects unsupported resume types", async () => {
    const auth = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "bad@example.com", name: "Bad", password: "password12" });
    const res = await request(app)
      .post("/api/v1/resumes")
      .set("Authorization", `Bearer ${auth.body.token}`)
      .attach("file", Buffer.from("not a resume"), "notes.txt");
    expect(res.status).toBe(400);
  });
});
