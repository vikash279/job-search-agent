import { beforeAll, afterAll } from "vitest";
import { mkdirSync } from "node:fs";
import path from "node:path";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-key-16ch";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "file:./test.db";
process.env.STORAGE_DIR = "./uploads-test";
process.env.LOG_LEVEL = "silent";

mkdirSync(path.resolve("uploads-test"), { recursive: true });

beforeAll(async () => {
  const { execSync } = await import("node:child_process");
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "pipe",
    env: process.env,
  });
});

afterAll(async () => {
  const { prisma } = await import("../src/db/prisma.js");
  await prisma.$disconnect();
});
