import { Router } from "express";
import { matchingThresholds, matchingWeights, matchingVersions } from "../../config/matching.js";
import { env } from "../../config/env.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { prisma } from "../../db/prisma.js";
import { listApplicationAdapters } from "../application-execution/registry.js";

export const settingsRouter = Router();

settingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const sources = await prisma.jobSource.findMany({
      select: { name: true, sourceType: true, enabled: true, baseUrl: true },
    });
    res.json({
      matching: {
        weights: matchingWeights,
        thresholds: matchingThresholds,
        versions: matchingVersions,
      },
      limits: {
        applicationMaxPerDay: env.APPLICATION_MAX_PER_DAY,
        jobSearchIntervalHours: env.JOB_SEARCH_INTERVAL_HOURS,
        maxUploadMb: env.MAX_UPLOAD_MB,
      },
      aiEnabled: Boolean(env.AI_API_KEY),
      sources,
      execution: {
        playwright: false,
        maxAttempts: env.APPLICATION_MAX_EXECUTION_ATTEMPTS,
        adapters: listApplicationAdapters(),
        note: "No real employer portal adapter has been tested. Assisted apply uses a local fixture or the employer URL.",
      },
    });
  }),
);
