import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";
import { enqueue } from "../../src/queue/index.js";
import { resetDb } from "../helpers.js";

const app = createApp();

describe("production readiness", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("returns a correlation id and a healthy database check", async () => {
    const health = await request(app).get("/health").set("x-correlation-id", "client-trace-1").expect(200);
    expect(health.body.ok).toBe(true);
    expect(health.body.db).toBe("up");
    expect(health.headers["x-correlation-id"]).toBe("client-trace-1");
  });

  it("blocks unauthenticated and traversal file access", async () => {
    const denied = await request(app).get("/api/v1/files/user/secret.pdf");
    expect(denied.status).toBe(401);

    const auth = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "files@example.com", name: "Files", password: "password12" });
    const stolen = await request(app)
      .get("/api/v1/files/" + encodeURIComponent("../../etc/passwd"))
      .set("Authorization", `Bearer ${auth.body.token}`);
    expect([403, 404]).toContain(stolen.status);
  });

  it("records login audits and reuses in-flight idempotent jobs", async () => {
    await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "audit@example.com", name: "Audit", password: "password12" })
      .expect(201);
    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "audit@example.com", password: "password12" })
      .expect(200);

    const loginAudit = await prisma.auditLog.findFirst({ where: { action: "user.login" } });
    expect(loginAudit).toBeTruthy();

    const first = await enqueue("job-matching", "bulk-match", { userId: "u1" }, {
      idempotencyKey: "job-matching:bulk-match:u1",
    });
    const second = await enqueue("job-matching", "bulk-match", { userId: "u1" }, {
      idempotencyKey: "job-matching:bulk-match:u1",
    });
    expect(second.id).toBe(first.id);
    const count = await prisma.queueJob.count({ where: { idempotencyKey: "job-matching:bulk-match:u1" } });
    expect(count).toBe(1);
  });
});
