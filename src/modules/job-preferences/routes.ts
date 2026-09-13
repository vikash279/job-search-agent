import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { validate } from "../../middleware/validate.js";
import {
  getOrCreatePreferences,
  previewSearch,
  searchPreviewSchema,
  serializePreferences,
  updatePreferences,
  updatePreferencesSchema,
} from "./service.js";

export const preferencesRouter = Router();

preferencesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ preferences: serializePreferences(await getOrCreatePreferences(req.user!.id)) });
  }),
);

preferencesRouter.put(
  "/",
  validate({ body: updatePreferencesSchema }),
  asyncHandler(async (req, res) => {
    res.json({ preferences: await updatePreferences(req.user!.id, req.body) });
  }),
);

preferencesRouter.post(
  "/search-preview",
  validate({ body: searchPreviewSchema }),
  asyncHandler(async (req, res) => {
    res.json({ preview: await previewSearch(req.user!.id, req.body.extraKeywords ?? []) });
  }),
);
