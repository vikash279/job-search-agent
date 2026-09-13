import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { asJson, asOptionalJson } from "../../lib/http.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { asStringArray } from "../../lib/json.js";
import { writeAudit } from "../audit/service.js";
import { getOrCreateProfile } from "../candidate-profile/service.js";
import { notify } from "../notifications/service.js";
import { verifyAnswerAgainstProfile } from "../application-preparation/answers.js";
import type { ExecutionResult } from "../application-execution/types.js";
import { assertTransition, type ApplicationStatus } from "./states.js";

export const updateApplicationSchema = z.object({
  coverLetter: z.string().max(8000).optional(),
  tailoredResume: z.string().max(20000).optional(),
  answers: z
    .array(
      z.object({
        id: z.string().optional(),
        fieldKey: z.string(),
        question: z.string(),
        answer: z.string(),
        source: z.enum(["profile", "resume", "user_input", "generated"]).optional(),
        confidence: z.number().min(0).max(1).optional(),
        requiresReview: z.boolean().optional(),
      }),
    )
    .optional(),
});

export const statusUpdateSchema = z.object({
  status: z.enum(["SUBMITTED", "FAILED", "WITHDRAWN", "REQUIRES_USER_ACTION"]),
  applicationUrl: z.string().url().optional(),
  errorMessage: z.string().max(2000).optional(),
});

function latestExecutionResult(
  events: Array<{ eventType: string; metadata: unknown }>,
): ExecutionResult | null {
  for (const event of events) {
    const metadata = (event.metadata ?? {}) as { result?: ExecutionResult };
    if (metadata.result?.status) return metadata.result;
  }
  return null;
}

export async function addEvent(
  applicationId: string,
  eventType: string,
  message: string,
  metadata: Record<string, unknown> = {},
) {
  return prisma.applicationEvent.create({
    data: { applicationId, eventType, message, metadata: asJson(metadata) },
  });
}

export async function getApplication(userId: string, id: string) {
  return serializeApplication(await loadApplication(userId, id));
}

export function serializeApplication(
  application: Awaited<ReturnType<typeof loadApplication>>,
) {
  const snapshot = (application.jobSnapshot ?? {}) as {
    title?: string;
    company?: string;
    description?: string;
    canonicalUrl?: string;
    resume?: { name?: string; parsedText?: string | null; fileKey?: string | null } | null;
  };
  const fieldsRequiringReview = application.answers
    .filter((answer) => answer.requiresReview && !answer.answer.trim())
    .map((answer) => ({ fieldKey: answer.fieldKey, question: answer.question }));
  const execution = latestExecutionResult(application.events);

  return {
    ...application,
    tailoringNotes: asStringArray(application.tailoringNotes),
    execution,
    review: {
      originalJobDescription: snapshot.description ?? application.job.description,
      originalJobTitle: snapshot.title ?? application.job.title,
      originalCompany: snapshot.company ?? application.job.company,
      selectedResumeName: snapshot.resume?.name ?? application.resume?.name ?? null,
      originalResumeText: snapshot.resume?.parsedText ?? application.resume?.parsedText ?? null,
      originalResumeFileKey: snapshot.resume?.fileKey ?? application.resume?.fileKey ?? null,
      fieldsRequiringReview,
      canApprove:
        application.status === "PENDING_APPROVAL" && fieldsRequiringReview.length === 0,
    },
  };
}

async function loadApplication(userId: string, id: string) {
  const application = await prisma.application.findFirst({
    where: { id, userId },
    include: {
      job: { include: { source: true } },
      resume: true,
      answers: true,
      events: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!application) throw new NotFoundError("Application not found");
  return application;
}

export async function listApplications(userId: string, status?: string) {
  return prisma.application.findMany({
    where: { userId, ...(status ? { status } : {}) },
    include: {
      job: { include: { source: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function transition(
  userId: string,
  applicationId: string,
  to: ApplicationStatus,
  extras: Record<string, unknown> = {},
) {
  const application = await getApplication(userId, applicationId);
  try {
    assertTransition(application.status, to);
  } catch {
    throw new ValidationError(`Cannot move application from ${application.status} to ${to}`);
  }

  const updated = await prisma.application.update({
    where: { id: application.id },
    data: {
      status: to,
      applicationUrl: (extras.applicationUrl as string | undefined) ?? application.applicationUrl,
      errorMessage: (extras.errorMessage as string | undefined) ?? null,
      appliedAt: to === "SUBMITTED" ? new Date() : application.appliedAt,
      submittedData: extras.submittedData
        ? asJson(extras.submittedData)
        : asOptionalJson(application.submittedData),
    },
  });
  await addEvent(application.id, `status.${to.toLowerCase()}`, `Status changed to ${to}`, extras);
  await writeAudit({
    userId,
    action: `application.${to.toLowerCase()}`,
    entity: "Application",
    entityId: application.id,
    metadata: extras,
  });
  return updated;
}

export async function updateApplication(
  userId: string,
  id: string,
  input: z.infer<typeof updateApplicationSchema>,
) {
  const application = await getApplication(userId, id);
  if (["SUBMITTED", "REJECTED", "WITHDRAWN"].includes(application.status)) {
    throw new ForbiddenError("This application can no longer be edited");
  }

  if (input.answers) {
    const profile = await getOrCreateProfile(userId);
    await prisma.applicationAnswer.deleteMany({ where: { applicationId: id } });
    await prisma.applicationAnswer.createMany({
      data: input.answers.map((answer) => {
        const source = answer.source ?? "user_input";
        const check = verifyAnswerAgainstProfile(profile, answer.question, answer.answer, source);
        const empty = !answer.answer.trim();
        return {
          applicationId: id,
          fieldKey: answer.fieldKey,
          question: answer.question,
          answer: answer.answer,
          source,
          confidence: answer.confidence ?? 1,
          requiresReview: empty || !check.ok,
        };
      }),
    });
  }

  await prisma.application.update({
    where: { id },
    data: {
      coverLetter: input.coverLetter ?? application.coverLetter,
      tailoredResume: input.tailoredResume ?? application.tailoredResume,
      answersSnapshot: asJson(input.answers ?? application.answersSnapshot ?? []),
      status: application.status === "APPROVED" ? "PENDING_APPROVAL" : application.status,
    },
  });
  await addEvent(id, "application.edited", "User edited the application package");
  return getApplication(userId, id);
}

export async function approveApplication(userId: string, id: string) {
  const application = await getApplication(userId, id);
  const profile = await getOrCreateProfile(userId);
  const pendingReview = application.answers.filter((answer) => answer.requiresReview && !answer.answer.trim());
  if (pendingReview.length) {
    throw new ValidationError("Resolve unanswered review fields before approval");
  }
  const invalid = application.answers
    .filter((answer) => answer.requiresReview)
    .map((answer) => ({
      answer,
      check: verifyAnswerAgainstProfile(profile, answer.question, answer.answer, answer.source),
    }))
    .filter((item) => !item.check.ok);
  if (invalid.length) {
    throw new ValidationError(
      `Answers need review: ${invalid.map((item) => item.check.reason).join("; ")}`,
    );
  }
  await transition(userId, id, "APPROVED");
  await notify({
    userId,
    type: "application",
    title: "Application approved",
    body: `Approved ${application.job.title} at ${application.job.company}`,
    metadata: { applicationId: id },
  });
  return getApplication(userId, id);
}

export async function rejectApplication(userId: string, id: string) {
  await transition(userId, id, "REJECTED");
  return getApplication(userId, id);
}

export async function cancelApplication(userId: string, id: string) {
  return transition(userId, id, "WITHDRAWN");
}

export async function assertNoDuplicate(userId: string, jobId: string) {
  const existing = await prisma.application.findUnique({
    where: { userId_jobId: { userId, jobId } },
  });
  if (existing && !["DRAFT", "PENDING_APPROVAL", "REJECTED", "WITHDRAWN"].includes(existing.status)) {
    throw new ConflictError("An application for this job already exists");
  }
  return existing;
}

export async function trackingSummary(userId: string) {
  const applications = await prisma.application.groupBy({
    by: ["status"],
    where: { userId },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(applications.map((row) => [row.status, row._count._all]));
  const recent = await prisma.application.findMany({
    where: { userId },
    include: { job: true },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });
  return { counts, recent };
}

export async function listEvents(userId: string, applicationId: string) {
  await getApplication(userId, applicationId);
  return prisma.applicationEvent.findMany({
    where: { applicationId },
    orderBy: { createdAt: "desc" },
  });
}

export async function userStatusUpdate(
  userId: string,
  applicationId: string,
  input: z.infer<typeof statusUpdateSchema>,
) {
  return transition(userId, applicationId, input.status, {
    applicationUrl: input.applicationUrl,
    errorMessage: input.errorMessage,
    submittedData: input.status === "SUBMITTED" ? { confirmedBy: "user" } : undefined,
  });
}
