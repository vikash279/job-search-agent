import { randomUUID } from "node:crypto";
import { prisma } from "../db/prisma.js";
import { asJson } from "../lib/http.js";
import { isUniqueConstraint } from "../lib/errors.js";
import { childLogger } from "../lib/logger.js";

export type QueueName =
  | "cv-parsing"
  | "job-discovery"
  | "job-normalization"
  | "job-matching"
  | "application-preparation"
  | "application-execution"
  | "application-tracking"
  | "notifications";

export interface EnqueueOptions {
  correlationId?: string;
  delayMs?: number;
  maxAttempts?: number;
  idempotencyKey?: string;
}

const IN_FLIGHT = ["pending", "retry", "active"] as const;

export async function enqueue(
  queue: QueueName,
  name: string,
  payload: Record<string, unknown>,
  options: EnqueueOptions = {},
) {
  if (options.idempotencyKey) {
    const existing = await prisma.queueJob.findFirst({
      where: {
        idempotencyKey: options.idempotencyKey,
        status: { in: [...IN_FLIGHT] },
      },
    });
    if (existing) {
      childLogger({
        jobId: existing.id,
        queue,
        name,
        correlationId: existing.correlationId,
      }).info("Reused in-flight queue job");
      return existing;
    }
  }

  try {
    const job = await prisma.queueJob.create({
      data: {
        queue,
        name,
        payload: asJson(payload),
        correlationId: options.correlationId ?? randomUUID(),
        maxAttempts: options.maxAttempts ?? 5,
        runAfter: new Date(Date.now() + (options.delayMs ?? 0)),
        idempotencyKey: options.idempotencyKey,
      },
    });
    childLogger({ jobId: job.id, queue, name, correlationId: job.correlationId }).info("Queued job");
    return job;
  } catch (error) {
    if (options.idempotencyKey && isUniqueConstraint(error)) {
      const raced = await prisma.queueJob.findFirst({
        where: { idempotencyKey: options.idempotencyKey },
      });
      if (raced) return raced;
    }
    throw error;
  }
}

export async function listFailedJobs(limit = 50) {
  return prisma.queueJob.findMany({
    where: { status: "failed" },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}
