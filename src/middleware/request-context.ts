import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { childLogger } from "../lib/logger.js";

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header("x-correlation-id")?.trim().replace(/[^\w.:-]/g, "");
  const correlationId = incoming && incoming.length <= 80 ? incoming : randomUUID();
  req.correlationId = correlationId;
  res.setHeader("x-correlation-id", correlationId);
  next();
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const started = Date.now();
  res.on("finish", () => {
    if (req.path === "/health") return;
    childLogger({
      correlationId: req.correlationId,
      userId: req.user?.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - started,
    }).info("request");
  });
  next();
}
