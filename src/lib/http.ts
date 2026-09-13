import type { Request } from "express";
import { Prisma } from "@prisma/client";
import { ValidationError } from "./errors.js";

export function routeParam(req: Request, key: string): string {
  const value = req.params[key];
  if (!value) throw new ValidationError(`Missing route parameter ${key}`);
  return value;
}

export function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

export function asOptionalJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return asJson(value);
}
