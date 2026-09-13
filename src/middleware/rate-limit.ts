import type { Request } from "express";
import rateLimit from "express-rate-limit";
import { env, isTest } from "../config/env.js";

export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    error: { code: "RATE_LIMITED", message: "Too many requests" },
  },
});

export const uploadRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    error: { code: "RATE_LIMITED", message: "Too many uploads" },
  },
});

export const applyRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: env.APPLICATION_MAX_PER_DAY,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  keyGenerator: (req: Request) => req.user?.id || "anonymous",
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Daily application limit reached",
    },
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    error: { code: "RATE_LIMITED", message: "Too many authentication attempts" },
  },
});
