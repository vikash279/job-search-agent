import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { resetDb } from "../helpers.js";

const app = createApp();

describe("job preferences", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("requires auth and stores user-specific preferences", async () => {
    expect((await request(app).get("/api/v1/preferences")).status).toBe(401);

    const auth = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "pref@example.com", name: "Pref", password: "password12" });
    const headers = { Authorization: `Bearer ${auth.body.token}` };

    const invalid = await request(app)
      .put("/api/v1/preferences")
      .set(headers)
      .send({ salaryMin: 200000, salaryMax: 100000 });
    expect(invalid.status).toBe(400);

    const saved = await request(app)
      .put("/api/v1/preferences")
      .set(headers)
      .send({
        targetRoles: ["TypeScript Engineer"],
        preferredTech: ["TypeScript", "React"],
        preferredLocations: ["Remote"],
        workModes: ["remote", "hybrid"],
        searchKeywords: ["typescript"],
        excludedCompanies: ["BlockedCo"],
        excludedKeywords: ["unpaid"],
        salaryMin: 130000,
        salaryMax: 180000,
        minimumMatchScore: 60,
      })
      .expect(200);

    expect(saved.body.preferences.targetRoles).toEqual(["TypeScript Engineer"]);
    expect(saved.body.preferences.workModes).toEqual(["remote", "hybrid"]);

    const preview = await request(app)
      .post("/api/v1/preferences/search-preview")
      .set(headers)
      .send({})
      .expect(200);
    expect(preview.body.preview.keywords).toEqual(expect.arrayContaining(["typescript", "TypeScript Engineer"]));
    expect(preview.body.preview.excludedCompanies).toEqual(["BlockedCo"]);
  });
});
