import { beforeEach, describe, expect, it } from "vitest";
import { createUser, resetDb, seedJobs } from "../helpers.js";
import { matchJobForUser } from "../../src/modules/job-matching/service.js";
import { prepareApplication } from "../../src/modules/application-preparation/service.js";
import { approveApplication, getApplication } from "../../src/modules/application/service.js";
import { startAssistedApplication } from "../../src/modules/application-execution/service.js";
import { prisma } from "../../src/db/prisma.js";
import { updateProfile } from "../../src/modules/candidate-profile/service.js";

describe("job ingestion matching and applications", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("ingests fixture jobs without duplicates", async () => {
    const first = await seedJobs();
    const second = await seedJobs();
    expect(second.length).toBe(first.length);
    const count = await prisma.job.count();
    expect(count).toBe(first.length);
  });

  it("matches, prepares, and requires approval before execution", async () => {
    const { user } = await createUser();
    await updateProfile(user.id, {
      headline: "Senior TypeScript Engineer",
      skills: ["TypeScript", "React", "Node"],
      noticePeriodDays: 30,
    });
    const jobs = await seedJobs();
    const tsJob = jobs.find((job) => job.title.includes("TypeScript"));
    expect(tsJob).toBeTruthy();

    const match = await matchJobForUser(user.id, tsJob!.id);
    expect(match.score).toBeGreaterThan(0);

    const prepared = await prepareApplication(user.id, tsJob!.id);
    expect(prepared.status).toBe("PENDING_APPROVAL");
    expect(prepared.coverLetter).toBeTruthy();

    await expect(startAssistedApplication(user.id, prepared.id)).rejects.toThrow(/approved/i);

    await prisma.applicationAnswer.updateMany({
      where: { applicationId: prepared.id, requiresReview: true },
      data: { answer: "I will confirm this with the employer.", requiresReview: false },
    });

    const approved = await approveApplication(user.id, prepared.id);
    expect(approved.status).toBe("APPROVED");

    const execution = await startAssistedApplication(user.id, prepared.id);
    expect(execution.status).toBe("REQUIRES_USER_ACTION");
    const after = await getApplication(user.id, prepared.id);
    expect(after.status).toBe("REQUIRES_USER_ACTION");
    expect(after.events.length).toBeGreaterThan(0);
  });
});
