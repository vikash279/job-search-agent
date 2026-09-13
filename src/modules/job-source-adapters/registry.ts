import { prisma } from "../../db/prisma.js";
import { FixtureAdapter } from "./fixture.js";
import { RemotiveAdapter } from "./remotive.js";
import type { JobSourceAdapter } from "./types.js";

const adapters: JobSourceAdapter[] = [];

export function registerAdapter(adapter: JobSourceAdapter): void {
  if (adapters.some((item) => item.source === adapter.source)) return;
  adapters.push(adapter);
}

export function listAdapters(): JobSourceAdapter[] {
  return [...adapters];
}

export function getAdapter(source: string): JobSourceAdapter | undefined {
  return adapters.find((adapter) => adapter.source === source);
}

export async function enabledAdapters(): Promise<JobSourceAdapter[]> {
  const rows = await prisma.jobSource.findMany({ where: { enabled: true } });
  const enabled = new Set(rows.map((row) => row.name));
  if (enabled.size === 0) return adapters.filter((adapter) => adapter.source === "fixture");
  return adapters.filter((adapter) => enabled.has(adapter.source));
}

export async function listSourceStatus() {
  await ensureDefaultSources();
  const rows = await prisma.jobSource.findMany({
    select: { name: true, sourceType: true, enabled: true, baseUrl: true },
    orderBy: { name: "asc" },
  });
  return rows.map((row) => ({
    ...row,
    registered: Boolean(getAdapter(row.name)),
    supportsApplication: getAdapter(row.name)?.supportsApplication() ?? false,
  }));
}

export async function ensureDefaultSources() {
  const defaults = adapters.map((adapter) => ({
    name: adapter.source,
    sourceType: adapter.source === "fixture" ? "local_fixture" : "public_api",
    baseUrl:
      adapter.source === "remotive"
        ? "https://remotive.com"
        : adapter.source === "fixture"
          ? "https://jobs.example.com"
          : `https://${adapter.source}.example`,
  }));
  for (const source of defaults) {
    await prisma.jobSource.upsert({
      where: { name: source.name },
      update: {},
      create: source,
    });
  }
}

registerAdapter(new RemotiveAdapter());
registerAdapter(new FixtureAdapter());
