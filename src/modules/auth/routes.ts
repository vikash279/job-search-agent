import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { authRateLimiter } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import { getMe, login, loginSchema, register, registerSchema } from "./service.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  authRateLimiter,
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const result = await register(req.body, req.ip);
    res.status(201).json(result);
  }),
);

authRouter.post(
  "/login",
  authRateLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    res.json(await login(req.body, req.ip));
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: await getMe(req.user!.id) });
  }),
);
