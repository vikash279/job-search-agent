import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/async-handler.js";
import { routeParam } from "../../lib/http.js";
import { validate } from "../../middleware/validate.js";
import { listNotifications, markRead } from "./service.js";

export const notificationsRouter = Router();

notificationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ notifications: await listNotifications(req.user!.id) });
  }),
);

notificationsRouter.post(
  "/:id/read",
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    await markRead(req.user!.id, routeParam(req, "id"));
    res.status(204).end();
  }),
);
