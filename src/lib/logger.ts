import pino from "pino";
import { env, isTest } from "../config/env.js";

const SENSITIVE = /(password|otp|token|cookie|authorization|secret|api[_-]?key)/i;

export const logger = pino({
  level: isTest ? "silent" : env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "password",
      "passwordHash",
      "token",
      "otp",
      "cookie",
      "cookies",
      "*.password",
      "*.token",
      "*.otp",
    ],
    remove: true,
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
});

export function sanitizeLogValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item));
  }
  if (value && typeof value === "object") {
    const clone: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      clone[key] = SENSITIVE.test(key) ? "[redacted]" : sanitizeLogValue(val);
    }
    return clone;
  }
  return value;
}

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(sanitizeLogValue(bindings) as Record<string, unknown>);
}
