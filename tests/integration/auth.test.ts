import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { resetDb } from "../helpers.js";

const app = createApp();

describe("authorization", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("rejects unauthenticated profile access", async () => {
    const res = await request(app).get("/api/v1/profile");
    expect(res.status).toBe(401);
  });

  it("isolates user data", async () => {
    const a = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "a@example.com", name: "A", password: "password12" });
    const b = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "b@example.com", name: "B", password: "password12" });

    await request(app)
      .patch("/api/v1/profile")
      .set("Authorization", `Bearer ${a.body.token}`)
      .send({ headline: "Secret headline" });

    const other = await request(app)
      .get("/api/v1/profile")
      .set("Authorization", `Bearer ${b.body.token}`);
    expect(other.body.profile.headline).not.toBe("Secret headline");
  });
});
