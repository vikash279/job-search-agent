import { describe, expect, it } from "vitest";
import type { CandidateProfile } from "@prisma/client";
import { AssistedUrlAdapter } from "../../src/modules/application-execution/adapters/assisted.js";
import { LocalApplicationAdapter, OPEN_LOCAL_FORM } from "../../src/modules/application-execution/adapters/local.js";
import { closeSession, getSession, listOpenSessions, openSession } from "../../src/modules/application-execution/session.js";
import { redactEventMetadata } from "../../src/modules/application-execution/redact.js";
import type { ExecutionContext } from "../../src/modules/application-execution/types.js";

const ctx: ExecutionContext = {
  user: { id: "u1", email: "ada@example.com", name: "Ada Lovelace" },
  profile: {
    verifiedFields: ["skills"],
    skills: ["TypeScript"],
  } as unknown as CandidateProfile,
  application: {
    id: "a1",
    status: "APPROVED",
    coverLetter: "Hello",
    tailoredResume: "TypeScript",
    applicationUrl: "https://jobs.example.com/role",
    resume: null,
    job: {
      title: "Engineer",
      company: "Northwind",
      canonicalUrl: "https://jobs.example.com/role",
      source: { name: "fixture" },
    },
    answers: [
      { fieldKey: "sponsorship", question: "Will you require visa sponsorship now or in the future?", answer: "I will confirm.", source: "user_input", requiresReview: false },
      { fieldKey: "work_authorization", question: "Are you legally authorized to work in the job location?", answer: "I will confirm.", source: "user_input", requiresReview: false },
      { fieldKey: "relocation", question: "Are you willing to relocate if required?", answer: "I will confirm.", source: "user_input", requiresReview: false },
    ],
  },
  completedCheckpoints: [],
};

describe("application execution adapters", () => {
  it("pauses the default local fixture on login and captcha", async () => {
    const result = await new LocalApplicationAdapter().apply(ctx);
    expect(result.status).toBe("REQUIRES_USER_ACTION");
    expect(result.testedAgainstPortal).toBe(false);
    expect(result.checkpoints.some((item) => item.reason === "captcha")).toBe(true);
    expect(result.checkpoints.some((item) => item.reason === "login")).toBe(true);
    expect(result.mappedFields.some((field) => "value" in field && field.value)).toBe(false);
  });

  it("marks a local form ready only after human gates are gone", async () => {
    const result = await new LocalApplicationAdapter(OPEN_LOCAL_FORM).apply({
      ...ctx,
      form: OPEN_LOCAL_FORM,
    });
    expect(result.status).toBe("READY_FOR_SUBMISSION");
    expect(result.checkpoints.some((item) => item.reason === "manual_submit")).toBe(true);
  });

  it("does not claim a remotive or unknown portal integration", async () => {
    const result = await new AssistedUrlAdapter().apply(ctx);
    expect(result.status).toBe("REQUIRES_USER_ACTION");
    expect(result.testedAgainstPortal).toBe(false);
    expect(result.message).toMatch(/No permitted portal adapter/i);
  });

  it("keeps sessions ephemeral and secret-free", () => {
    const session = openSession("app-1", "fixture");
    expect(getSession(session.id)).toEqual(session);
    expect(session).not.toHaveProperty("cookie");
    expect(session).not.toHaveProperty("token");
    expect(session).not.toHaveProperty("password");
    closeSession(session.id);
    expect(getSession(session.id)).toBeUndefined();
    expect(listOpenSessions()).toHaveLength(0);
  });

  it("redacts passwords, otps, cookies, and tokens from event metadata", () => {
    const redacted = redactEventMetadata({
      password: "secret",
      otp: "123456",
      cookie: "sid=abc",
      token: "jwt",
      note: "safe",
    }) as Record<string, unknown>;
    expect(redacted.password).toBe("[redacted]");
    expect(redacted.otp).toBe("[redacted]");
    expect(redacted.cookie).toBe("[redacted]");
    expect(redacted.token).toBe("[redacted]");
    expect(redacted.note).toBe("safe");
  });
});
