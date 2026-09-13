import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/async-handler.js";
import { routeParam } from "../../lib/http.js";
import { applyRateLimiter } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import {
  confirmSubmission,
  continueAssistedApplication,
  continueExecutionSchema,
  retryAssistedApplication,
  startAssistedApplication,
} from "../application-execution/service.js";
import { prepareApplication, prepareSchema } from "../application-preparation/service.js";
import {
  approveApplication,
  cancelApplication,
  getApplication,
  listApplications,
  listEvents,
  rejectApplication,
  statusUpdateSchema,
  trackingSummary,
  updateApplication,
  updateApplicationSchema,
  userStatusUpdate,
} from "./service.js";

export const applicationsRouter = Router();

applicationsRouter.post(
  "/prepare",
  validate({ body: prepareSchema }),
  asyncHandler(async (req, res) => {
    const application = await prepareApplication(req.user!.id, req.body.jobId, req.body.resumeVersionId);
    res.status(201).json({ application });
  }),
);

applicationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json({ applications: await listApplications(req.user!.id, status) });
  }),
);

applicationsRouter.get(
  "/:id",
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    res.json({ application: await getApplication(req.user!.id, routeParam(req, "id")) });
  }),
);

applicationsRouter.patch(
  "/:id",
  validate({ params: z.object({ id: z.string() }), body: updateApplicationSchema }),
  asyncHandler(async (req, res) => {
    res.json({ application: await updateApplication(req.user!.id, routeParam(req, "id"), req.body) });
  }),
);

applicationsRouter.post(
  "/:id/approve",
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    res.json({ application: await approveApplication(req.user!.id, routeParam(req, "id")) });
  }),
);

applicationsRouter.post(
  "/:id/reject",
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    res.json({ application: await rejectApplication(req.user!.id, routeParam(req, "id")) });
  }),
);

applicationsRouter.post(
  "/:id/start",
  applyRateLimiter,
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    const execution = await startAssistedApplication(req.user!.id, routeParam(req, "id"));
    res.json({ execution });
  }),
);

applicationsRouter.post(
  "/:id/continue",
  applyRateLimiter,
  validate({ params: z.object({ id: z.string() }), body: continueExecutionSchema }),
  asyncHandler(async (req, res) => {
    const execution = await continueAssistedApplication(
      req.user!.id,
      routeParam(req, "id"),
      req.body,
    );
    res.json({ execution });
  }),
);

applicationsRouter.post(
  "/:id/retry",
  applyRateLimiter,
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    const execution = await retryAssistedApplication(req.user!.id, routeParam(req, "id"));
    res.json({ execution });
  }),
);

applicationsRouter.post(
  "/:id/confirm-submit",
  validate({
    params: z.object({ id: z.string() }),
    body: z.object({ applicationUrl: z.string().url().optional() }),
  }),
  asyncHandler(async (req, res) => {
    res.json({
      application: await confirmSubmission(
        req.user!.id,
        routeParam(req, "id"),
        req.body.applicationUrl,
      ),
    });
  }),
);

applicationsRouter.post(
  "/:id/cancel",
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    res.json({ application: await cancelApplication(req.user!.id, routeParam(req, "id")) });
  }),
);

applicationsRouter.get(
  "/:id/events",
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    res.json({ events: await listEvents(req.user!.id, routeParam(req, "id")) });
  }),
);

applicationsRouter.post(
  "/:id/status",
  validate({ params: z.object({ id: z.string() }), body: statusUpdateSchema }),
  asyncHandler(async (req, res) => {
    res.json({ application: await userStatusUpdate(req.user!.id, routeParam(req, "id"), req.body) });
  }),
);

export const trackingRouter = Router();

trackingRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    res.json(await trackingSummary(req.user!.id));
  }),
);
