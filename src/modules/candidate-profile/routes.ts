import { Router } from "express";
import multer from "multer";
import { env } from "../../config/env.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { ValidationError } from "../../lib/errors.js";
import { uploadRateLimiter } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import { parseResumeJob, uploadResume } from "../resume/service.js";
import { getOrCreateProfile, serializeProfile, updateProfile, updateProfileSchema } from "./service.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
});

export const profileRouter = Router();

profileRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const profile = await getOrCreateProfile(req.user!.id);
    res.json({ profile: serializeProfile(profile) });
  }),
);

profileRouter.patch(
  "/",
  validate({ body: updateProfileSchema }),
  asyncHandler(async (req, res) => {
    res.json({ profile: await updateProfile(req.user!.id, req.body) });
  }),
);

profileRouter.post(
  "/parse-resume",
  uploadRateLimiter,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError("Resume file is required");
    const resume = await uploadResume(req.user!.id, req.file, req.body?.name);
    await parseResumeJob(resume.id, req.user!.id);
    const profile = await getOrCreateProfile(req.user!.id);
    const updated = await (await import("../resume/service.js")).getResume(req.user!.id, resume.id);
    res.status(201).json({
      resume: updated,
      profile: serializeProfile(profile),
    });
  }),
);
