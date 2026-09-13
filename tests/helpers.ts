import { prisma } from "../src/db/prisma.js";
import { register } from "../src/modules/auth/service.js";
import { persistJobs } from "../src/modules/job-discovery/service.js";
import { FIXTURE_JOBS } from "../src/modules/job-source-adapters/fixture.js";
import { ensureDefaultSources } from "../src/modules/job-source-adapters/registry.js";

export async function resetDb() {
  await prisma.applicationEvent.deleteMany();
  await prisma.applicationAnswer.deleteMany();
  await prisma.application.deleteMany();
  await prisma.jobMatch.deleteMany();
  await prisma.savedJob.deleteMany();
  await prisma.job.deleteMany();
  await prisma.resumeVersion.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.queueJob.deleteMany();
  await prisma.candidateProfile.deleteMany();
  await prisma.jobPreference.deleteMany();
  await prisma.jobSource.deleteMany();
  await prisma.user.deleteMany();
}

export async function createUser(email = `user-${Date.now()}@example.com`) {
  return register({ email, name: "Test User", password: "password12" });
}

export async function seedJobs() {
  await ensureDefaultSources();
  return persistJobs(FIXTURE_JOBS);
}
