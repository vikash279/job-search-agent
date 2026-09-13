import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { env } from "./config/env.js";
import { asyncHandler } from "./lib/async-handler.js";
import { prisma } from "./db/prisma.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { apiRateLimiter } from "./middleware/rate-limit.js";
import { requestContext, requestLogger } from "./middleware/request-context.js";
import { authRouter } from "./modules/auth/routes.js";
import { profileRouter } from "./modules/candidate-profile/routes.js";
import { resumeRouter } from "./modules/resume/routes.js";
import { preferencesRouter } from "./modules/job-preferences/routes.js";
import { jobsRouter } from "./modules/job-discovery/routes.js";
import { applicationsRouter, trackingRouter } from "./modules/application/routes.js";
import { notificationsRouter } from "./modules/notifications/routes.js";
import { settingsRouter } from "./modules/settings/routes.js";
import { ForbiddenError } from "./lib/errors.js";
import { assertOwnedFileKey } from "./modules/resume/service.js";
import { readFileStream } from "./storage/index.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN.split(",").map((item) => item.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(requestContext);
  app.use(requestLogger);
  app.use(apiRateLimiter);

  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, service: "job-search-agent", db: "up" });
    } catch {
      res.status(503).json({ ok: false, service: "job-search-agent", db: "down" });
    }
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/profile", requireAuth, profileRouter);
  app.use("/api/v1/resumes", requireAuth, resumeRouter);
  app.use("/api/v1/preferences", requireAuth, preferencesRouter);
  app.use("/api/v1/jobs", requireAuth, jobsRouter);
  app.use("/api/v1/applications", requireAuth, applicationsRouter);
  app.use("/api/v1/tracking", requireAuth, trackingRouter);
  app.use("/api/v1/notifications", requireAuth, notificationsRouter);
  app.use("/api/v1/settings", requireAuth, settingsRouter);

  app.get(
    "/api/v1/files/*",
    requireAuth,
    asyncHandler(async (req, res) => {
      const wildcard = req.params[0] ?? "";
      const key = decodeURIComponent(wildcard);
      if (!key) throw new ForbiddenError();
      await assertOwnedFileKey(req.user!.id, key);
      const stream = await readFileStream(key);
      stream.pipe(res);
    }),
  );

  if (env.NODE_ENV === "production") {
    const clientDir = path.resolve("client/dist");
    app.use(express.static(clientDir));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(clientDir, "index.html"));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
