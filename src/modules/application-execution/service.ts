import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { ForbiddenError, RateLimitError, ValidationError } from "../../lib/errors.js";
import { childLogger } from "../../lib/logger.js";
import { writeAudit } from "../audit/service.js";
import { getOrCreateProfile } from "../candidate-profile/service.js";
import { notify } from "../notifications/service.js";
import { addEvent, getApplication, transition, userStatusUpdate } from "../application/service.js";
import { HUMAN_GATES, type ExecutionPackage, type ExecutionResult, type HumanGate } from "./types.js";
import { resolveApplicationAdapter } from "./registry.js";
import { redactEventMetadata, redactExecutionResult } from "./redact.js";
import { closeSession, openSession } from "./session.js";
import { assertApprovedForExecution } from "./validate.js";

export const continueExecutionSchema = z
  .object({
    completedCheckpoints: z.array(z.enum(HUMAN_GATES)).default([]),
  })
  .default({ completedCheckpoints: [] });

function toPackage(application: Awaited<ReturnType<typeof getApplication>>): ExecutionPackage {
  return {
    id: application.id,
    status: application.status,
    coverLetter: application.coverLetter,
    tailoredResume: application.tailoredResume,
    applicationUrl: application.applicationUrl,
    resume: application.resume
      ? { name: application.resume.name, fileKey: application.resume.fileKey ?? "" }
      : null,
    job: {
      title: application.job.title,
      company: application.job.company,
      canonicalUrl: application.job.canonicalUrl,
      source: application.job.source,
    },
    answers: application.answers,
  };
}

function countAttempts(application: Awaited<ReturnType<typeof getApplication>>): number {
  return application.events.filter((event) => event.eventType === "execution.started").length;
}

async function assertDailyLimit(userId: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const submittedToday = await prisma.application.count({
    where: { userId, appliedAt: { gte: start } },
  });
  if (submittedToday >= env.APPLICATION_MAX_PER_DAY) {
    throw new RateLimitError("Daily application limit reached");
  }
}

async function persistResult(
  userId: string,
  applicationId: string,
  result: ExecutionResult,
) {
  const eventType =
    result.status === "FAILED"
      ? "execution.failed"
      : result.status === "READY_FOR_SUBMISSION"
        ? "execution.ready"
        : "execution.paused";
  await addEvent(
    applicationId,
    eventType,
    result.message,
    redactEventMetadata({ result, checkpoints: result.checkpoints }),
  );
  await writeAudit({
    userId,
    action: `application.${eventType}`,
    entity: "Application",
    entityId: applicationId,
    metadata: redactEventMetadata({
      status: result.status,
      adapter: result.adapter,
      testedAgainstPortal: result.testedAgainstPortal,
      checkpoints: (result.checkpoints ?? []).map((item) => item.reason),
    }),
  });
  await transition(userId, applicationId, result.status, {
    applicationUrl: result.applicationUrl,
    errorMessage: result.status === "FAILED" ? result.message : null,
  });
  await notify({
    userId,
    type: "application",
    title:
      result.status === "FAILED"
        ? "Assisted apply failed"
        : result.status === "READY_FOR_SUBMISSION"
          ? "Application ready for you to submit"
          : "Harbor paused for your action",
    body: result.message,
    metadata: { applicationId, status: result.status },
  });
}

async function runAdapter(
  userId: string,
  applicationId: string,
  completedCheckpoints: HumanGate[] = [],
): Promise<ExecutionResult> {
  const application = await getApplication(userId, applicationId);
  const profile = await getOrCreateProfile(userId);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  const pack = toPackage(application);
  const source = application.job.source?.name ?? "unknown";
  const adapter = resolveApplicationAdapter({
    source,
    canonicalUrl: application.job.canonicalUrl,
  });
  const attempt = countAttempts(application);
  const session = openSession(applicationId, adapter.source);
  childLogger({ applicationId, adapter: adapter.source, sessionId: session.id }).info(
    "Assisted execution started",
  );

  try {
    const raw = await adapter.apply({
      user,
      profile,
      application: pack,
      completedCheckpoints,
    });
    const result = redactExecutionResult({ ...raw, attempt });
    await addEvent(
      applicationId,
      "execution.mapped",
      `Mapped ${result.mappedFields.filter((field) => field.filled).length} verified fields`,
      redactEventMetadata({
        adapter: result.adapter,
        filled: result.mappedFields.filter((field) => field.filled).map((field) => field.key),
        skipped: result.mappedFields.filter((field) => !field.filled).map((field) => field.key),
      }),
    );
    await persistResult(userId, applicationId, result);
    return result;
  } catch (error) {
    const result = redactExecutionResult({
      status: "FAILED",
      adapter: adapter.source,
      testedAgainstPortal: adapter.testedAgainstPortal,
      applicationUrl: application.job.canonicalUrl,
      message: error instanceof Error ? error.message : "Assisted apply failed",
      mappedFields: [],
      checkpoints: [],
      retryable: attempt < env.APPLICATION_MAX_EXECUTION_ATTEMPTS,
      attempt,
    });
    await persistResult(userId, applicationId, result);
    return result;
  } finally {
    closeSession(session.id);
  }
}

/**
 * Assisted execution only. Adapters never submit to an employer,
 * never store portal credentials, and never bypass CAPTCHA/OTP/MFA.
 */
export async function startAssistedApplication(
  userId: string,
  applicationId: string,
): Promise<ExecutionResult> {
  const application = await getApplication(userId, applicationId);
  const profile = await getOrCreateProfile(userId);
  assertApprovedForExecution(toPackage(application), profile);
  await assertDailyLimit(userId);

  const attempts = countAttempts(application);
  if (application.status === "FAILED" && attempts >= env.APPLICATION_MAX_EXECUTION_ATTEMPTS) {
    throw new ValidationError("Maximum assisted-apply attempts reached");
  }

  if (application.status === "FAILED") {
    await transition(userId, applicationId, "APPROVED");
  }

  await transition(userId, applicationId, "IN_PROGRESS");
  await addEvent(
    applicationId,
    "execution.started",
    "Assisted apply started. Portal login, CAPTCHA, OTP, and MFA must be completed by the user.",
    redactEventMetadata({ attempt: attempts + 1 }),
  );
  await writeAudit({
    userId,
    action: "application.execution.started",
    entity: "Application",
    entityId: applicationId,
    metadata: { attempt: attempts + 1 },
  });
  return runAdapter(userId, applicationId);
}

export async function continueAssistedApplication(
  userId: string,
  applicationId: string,
  input: z.infer<typeof continueExecutionSchema>,
): Promise<ExecutionResult> {
  const application = await getApplication(userId, applicationId);
  const profile = await getOrCreateProfile(userId);
  assertApprovedForExecution(toPackage(application), profile, { allowPaused: true });
  if (application.status !== "REQUIRES_USER_ACTION") {
    throw new ForbiddenError("Continue is only available while Harbor is waiting on you");
  }
  await assertDailyLimit(userId);

  await addEvent(
    applicationId,
    "execution.checkpoint",
    "User reported completing a human checkpoint. Harbor did not receive OTPs, passwords, or cookies.",
    redactEventMetadata({ completedCheckpoints: input.completedCheckpoints }),
  );
  await transition(userId, applicationId, "IN_PROGRESS");
  return runAdapter(userId, applicationId, input.completedCheckpoints);
}

export async function retryAssistedApplication(userId: string, applicationId: string) {
  const application = await getApplication(userId, applicationId);
  if (application.status !== "FAILED") {
    throw new ForbiddenError("Only a failed assisted apply can be retried");
  }
  await addEvent(applicationId, "execution.retry", "User requested another assisted-apply attempt");
  return startAssistedApplication(userId, applicationId);
}

export async function confirmSubmission(
  userId: string,
  applicationId: string,
  applicationUrl?: string,
) {
  const application = await getApplication(userId, applicationId);
  if (!["REQUIRES_USER_ACTION", "READY_FOR_SUBMISSION"].includes(application.status)) {
    throw new ForbiddenError("Confirm submission only after you have sent the application yourself");
  }
  await addEvent(
    applicationId,
    "execution.submitted",
    "User confirmed they submitted on the employer site",
    redactEventMetadata({ confirmedBy: "user" }),
  );
  return userStatusUpdate(userId, applicationId, {
    status: "SUBMITTED",
    applicationUrl,
  });
}
