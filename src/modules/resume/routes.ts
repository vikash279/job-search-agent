import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { env } from "../../config/env.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { routeParam } from "../../lib/http.js";
import { ValidationError } from "../../lib/errors.js";
import { safeDownloadName } from "../../lib/files.js";
import { uploadRateLimiter } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import {
  deleteResume,
  getResume,
  listResumes,
  openResumeFile,
  updateResume,
  updateResumeSchema,
  uploadResume,
} from "./service.js";
import { tailorResume } from "../application-preparation/service.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
});

export const resumeRouter = Router();

resumeRouter.post(
  "/",
  uploadRateLimiter,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError("Resume file is required");
    const name = typeof req.body?.name === "string" ? req.body.name : undefined;
    const resume = await uploadResume(req.user!.id, req.file, name);
    res.status(201).json({ resume });
  }),
);

resumeRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ resumes: await listResumes(req.user!.id) });
  }),
);

resumeRouter.get(
  "/:id",
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    res.json({ resume: await getResume(req.user!.id, routeParam(req, "id")) });
  }),
);

resumeRouter.get(
  "/:id/file",
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    const { resume, stream } = await openResumeFile(req.user!.id, routeParam(req, "id"));
    res.setHeader("Content-Type", resume.fileType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${safeDownloadName(resume.name)}"`);
    stream.pipe(res);
  }),
);

resumeRouter.patch(
  "/:id",
  validate({ params: z.object({ id: z.string() }), body: updateResumeSchema }),
  asyncHandler(async (req, res) => {
    res.json({ resume: await updateResume(req.user!.id, routeParam(req, "id"), req.body) });
  }),
);

resumeRouter.delete(
  "/:id",
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    await deleteResume(req.user!.id, routeParam(req, "id"));
    res.status(204).end();
  }),
);

resumeRouter.post(
  "/:id/tailor",
  validate({
    params: z.object({ id: z.string() }),
    body: z.object({ jobId: z.string() }),
  }),
  asyncHandler(async (req, res) => {
    res.json(await tailorResume(req.user!.id, routeParam(req, "id"), req.body.jobId));
  }),
);
