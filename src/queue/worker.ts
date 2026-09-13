import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { childLogger, logger } from "../lib/logger.js";
import { handlers } from "./handlers.js";
import type { QueueName } from "./index.js";

const BACKOFF_MS = [5_000, 15_000, 45_000, 120_000, 300_000];

async function releaseStaleLocks() {
  await prisma.queueJob.updateMany({
    where: {
      status: "active",
      lockedAt: { lt: new Date(Date.now() - env.QUEUE_STALE_LOCK_MS) },
    },
    data: { status: "retry", lockedAt: null },
  });
}

async function claimNext() {
  await releaseStaleLocks();
  const now = new Date();
  const next = await prisma.queueJob.findFirst({
    where: {
      status: { in: ["pending", "retry"] },
      runAfter: { lte: now },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!next) return null;

  const claimed = await prisma.queueJob.updateMany({
    where: { id: next.id, status: next.status },
    data: { status: "active", lockedAt: now, attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return null;
  return prisma.queueJob.findUnique({ where: { id: next.id } });
}

export async function processOne(): Promise<boolean> {
  const job = await claimNext();
  if (!job) return false;

  const log = childLogger({
    jobId: job.id,
    queue: job.queue,
    name: job.name,
    correlationId: job.correlationId,
  });

  try {
    const handler = handlers[job.queue as QueueName]?.[job.name];
    if (!handler) throw new Error(`No handler for ${job.queue}/${job.name}`);
    await handler(job.payload as Record<string, unknown>, job.correlationId);
    await prisma.queueJob.update({
      where: { id: job.id },
      data: { status: "completed", finishedAt: new Date(), lastError: null },
    });
    log.info("Job completed");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const retry = job.attempts < job.maxAttempts;
    const delay = BACKOFF_MS[Math.min(job.attempts - 1, BACKOFF_MS.length - 1)] ?? 300_000;
    await prisma.queueJob.update({
      where: { id: job.id },
      data: {
        status: retry ? "retry" : "failed",
        lastError: message,
        runAfter: new Date(Date.now() + delay),
        finishedAt: retry ? null : new Date(),
      },
    });
    log.warn({ err: error, retry }, "Job failed");
  }
  return true;
}

export function startWorker(intervalMs = 750) {
  logger.info("Background worker started");
  const timer = setInterval(() => {
    processOne().catch((error) => logger.error({ err: error }, "Worker loop error"));
  }, intervalMs);
  timer.unref?.();
  return timer;
}
