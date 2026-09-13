import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError, isUniqueConstraint } from "../lib/errors.js";
import { childLogger } from "../lib/logger.js";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        details: err.flatten(),
      },
    });
    return;
  }

  if (isUniqueConstraint(err)) {
    res.status(409).json({
      error: {
        code: "CONFLICT",
        message: "A record with those unique values already exists",
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  childLogger({
    err,
    path: req.path,
    method: req.method,
    correlationId: req.correlationId,
    userId: req.user?.id,
  }).error("Unhandled error");
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}
