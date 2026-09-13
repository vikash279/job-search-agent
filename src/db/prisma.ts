import { PrismaClient } from "@prisma/client";
import { env, isTest } from "../config/env.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isTest || env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
