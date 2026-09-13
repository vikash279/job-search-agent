import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/async-handler.js";
import { routeParam } from "../../lib/http.js";
import { validate } from "../../middleware/validate.js";
import { matchJobForUser, matchUnscoredJobs } from "../job-matching/service.js";
import {
  getJob,
  listJobSources,
  listJobs,
  listJobsQuerySchema,
  saveJob,
  searchForUser,
  searchJobsSchema,
  unsaveJob,
} from "./service.js";

export const jobsRouter = Router();

jobsRouter.post(
  "/search",
  validate({ body: searchJobsSchema }),
  asyncHandler(async (req, res) => {
    const result = await searchForUser(req.user!.id, req.body);
    res.json({
      queued: result.queued,
      queueJobId: result.queueJobId,
      count: result.jobs.length,
      jobs: result.jobs.map((job) => ({ id: job.id, title: job.title, company: job.company })),
    });
  }),
);

jobsRouter.get(
  "/sources",
  asyncHandler(async (_req, res) => {
    res.json({ sources: await listJobSources() });
  }),
);

jobsRouter.get(
  "/",
  validate({ query: listJobsQuerySchema }),
  asyncHandler(async (req, res) => {
    res.json(await listJobs(req.user!.id, req.query as unknown as z.infer<typeof listJobsQuerySchema>));
  }),
);

jobsRouter.post(
  "/bulk-match",
  asyncHandler(async (req, res) => {
    res.json({ matches: await matchUnscoredJobs(req.user!.id) });
  }),
);

jobsRouter.get(
  "/:id",
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    res.json({ job: await getJob(req.user!.id, routeParam(req, "id")) });
  }),
);

jobsRouter.post(
  "/:id/match",
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    res.json({ match: await matchJobForUser(req.user!.id, routeParam(req, "id")) });
  }),
);

jobsRouter.post(
  "/:id/save",
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    await saveJob(req.user!.id, routeParam(req, "id"));
    res.status(204).end();
  }),
);

jobsRouter.delete(
  "/:id/save",
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    await unsaveJob(req.user!.id, routeParam(req, "id"));
    res.status(204).end();
  }),
);
