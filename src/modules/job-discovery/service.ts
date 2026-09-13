import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { asJson } from "../../lib/http.js";
import { asStringArray } from "../../lib/json.js";
import { NotFoundError } from "../../lib/errors.js";
import { canonicalizeUrl } from "../../lib/urls.js";
import { enqueue } from "../../queue/index.js";
import { writeAudit } from "../audit/service.js";
import { previewSearch } from "../job-preferences/service.js";
import { ensureDefaultSources, enabledAdapters, listSourceStatus } from "../job-source-adapters/registry.js";
import { normalizeJob } from "../job-source-adapters/normalize.js";
import type { JobSearchParams, NormalizedJob } from "../job-source-adapters/types.js";
import { dedupeNormalized, isLikelyDuplicate } from "./dedupe.js";

export const searchJobsSchema = z.object({
  keywords: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  remoteOnly: z.boolean().optional(),
  postedWithinDays: z.number().int().min(1).max(90).optional(),
  page: z.number().int().min(1).optional(),
  source: z.string().optional(),
  async: z.boolean().optional(),
});

export const listJobsQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  saved: z.enum(["true", "false"]).optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  applyPreferences: z.enum(["true", "false"]).optional(),
});

export async function persistJobs(jobs: NormalizedJob[]) {
  await ensureDefaultSources();
  const sources = await prisma.jobSource.findMany();
  const byName = new Map(sources.map((source) => [source.name, source]));
  const saved = [];

  for (const raw of dedupeNormalized(jobs.map(normalizeJob))) {
    const source = byName.get(raw.source);
    if (!source) continue;
    const externalId = raw.externalId || raw.canonicalUrl;
    const payload = {
      sourceId: source.id,
      externalId,
      canonicalUrl: canonicalizeUrl(raw.canonicalUrl),
      title: raw.title,
      company: raw.company,
      location: raw.location,
      workMode: raw.workMode,
      employmentType: raw.employmentType,
      salaryMin: raw.salaryMin,
      salaryMax: raw.salaryMax,
      salaryCurrency: raw.salaryCurrency,
      description: raw.description,
      requirements: asJson(raw.requirements ?? []),
      skills: asJson(raw.skills ?? []),
      postedAt: raw.postedAt,
      rawData: raw.raw ? asJson(raw.raw) : undefined,
      status: "active",
    };

    const existingByIdentity = await prisma.job.findUnique({
      where: { sourceId_externalId: { sourceId: source.id, externalId } },
    });
    const existingByUrl = existingByIdentity
      ? null
      : await prisma.job.findFirst({ where: { canonicalUrl: payload.canonicalUrl } });
    const existingByTitle = existingByIdentity || existingByUrl
      ? null
      : (await prisma.job.findMany({ where: { company: raw.company } })).find((job) =>
          isLikelyDuplicate(raw, job),
        );

    const existing = existingByIdentity ?? existingByUrl ?? existingByTitle ?? null;
    const job = existing
      ? await prisma.job.update({ where: { id: existing.id }, data: payload })
      : await prisma.job.create({ data: payload });
    saved.push(job);
  }
  return saved;
}

export async function searchAndIngest(userId: string, params: JobSearchParams & { source?: string }) {
  await ensureDefaultSources();
  const adapters = await enabledAdapters();
  const selected = params.source
    ? adapters.filter((adapter) => adapter.source === params.source)
    : adapters;

  const collected: NormalizedJob[] = [];
  for (const adapter of selected) {
    try {
      const found = await adapter.search(params);
      collected.push(...found);
    } catch (error) {
      const message = error instanceof Error ? error.message : "search failed";
      await writeAudit({
        userId,
        action: "job.search.error",
        entity: "JobSource",
        entityId: adapter.source,
        metadata: { message },
      });
    }
  }

  const jobs = await persistJobs(collected);
  await writeAudit({
    userId,
    action: "job.search",
    entity: "Job",
    metadata: { count: jobs.length, keywords: params.keywords },
  });
  return jobs;
}

export async function searchForUser(userId: string, input: z.infer<typeof searchJobsSchema>) {
  const preview = await previewSearch(userId, input.keywords ?? []);
  const params = {
    keywords: preview.keywords.length ? preview.keywords : ["software engineer"],
    locations: input.locations ?? preview.locations,
    remoteOnly: input.remoteOnly ?? preview.remoteOnly,
    postedWithinDays: input.postedWithinDays,
    page: input.page,
    source: input.source,
  };

  if (input.async) {
    const job = await enqueue("job-discovery", "search", { userId, ...params }, {
      correlationId: userId,
      idempotencyKey: `job-discovery:search:${userId}:${params.source ?? "all"}:${params.keywords.join("|")}`,
    });
    await enqueue("job-matching", "bulk-match", { userId }, {
      correlationId: userId,
      delayMs: 2_000,
      idempotencyKey: `job-matching:bulk-match:${userId}`,
    });
    return { queued: true, queueJobId: job.id, jobs: [] as Awaited<ReturnType<typeof searchAndIngest>> };
  }

  const jobs = await searchAndIngest(userId, params);
  await enqueue("job-matching", "bulk-match", { userId }, {
    correlationId: userId,
    idempotencyKey: `job-matching:bulk-match:${userId}`,
  });
  return { queued: false, queueJobId: undefined, jobs };
}

export async function listJobs(
  userId: string,
  query: z.infer<typeof listJobsQuerySchema>,
) {
  const where: Record<string, unknown> = { status: "active" };
  if (query.q) {
    where.OR = [
      { title: { contains: query.q } },
      { company: { contains: query.q } },
      { location: { contains: query.q } },
    ];
  }
  if (query.saved === "true") {
    where.savedBy = { some: { userId } };
  }

  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      include: {
        source: true,
        matches: { where: { userId } },
        applications: { where: { userId }, select: { id: true, status: true } },
        savedBy: { where: { userId } },
      },
      orderBy: { postedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  let items = jobs.map((job) => ({
    ...serializeJob(job),
    match: job.matches[0] ?? null,
    applicationStatus: job.applications[0]?.status ?? null,
    saved: job.savedBy.length > 0,
  }));

  if (query.applyPreferences !== "false") {
    const preferences = await previewSearch(userId);
    items = items.filter((job) => {
      const companyBlocked = preferences.excludedCompanies.some(
        (company) => company.toLowerCase() === job.company.toLowerCase(),
      );
      const keywordBlocked = preferences.excludedKeywords.some((keyword) =>
        `${job.title} ${job.description}`.toLowerCase().includes(keyword.toLowerCase()),
      );
      return !companyBlocked && !keywordBlocked;
    });
  }

  items = items.filter((job) => (query.minScore ? (job.match?.score ?? 0) >= query.minScore : true));

  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function listJobSources() {
  return listSourceStatus();
}

export async function getJob(userId: string, id: string) {
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      source: true,
      matches: { where: { userId } },
      applications: { where: { userId } },
      savedBy: { where: { userId } },
    },
  });
  if (!job) throw new NotFoundError("Job not found");
  return {
    ...serializeJob(job),
    match: job.matches[0] ?? null,
    application: job.applications[0] ?? null,
    saved: job.savedBy.length > 0,
  };
}

export function serializeJob(job: {
  id: string;
  title: string;
  company: string;
  location: string | null;
  workMode: string | null;
  employmentType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  description: string;
  requirements: unknown;
  skills: unknown;
  postedAt: Date | null;
  expiresAt: Date | null;
  status: string;
  canonicalUrl: string;
  source?: { name: string };
}) {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    workMode: job.workMode,
    employmentType: job.employmentType,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryCurrency: job.salaryCurrency,
    description: job.description,
    requirements: asStringArray(job.requirements),
    skills: asStringArray(job.skills),
    postedAt: job.postedAt,
    expiresAt: job.expiresAt,
    status: job.status,
    canonicalUrl: job.canonicalUrl,
    source: job.source?.name,
  };
}

export async function saveJob(userId: string, jobId: string) {
  await getJob(userId, jobId);
  return prisma.savedJob.upsert({
    where: { userId_jobId: { userId, jobId } },
    update: {},
    create: { userId, jobId },
  });
}

export async function unsaveJob(userId: string, jobId: string) {
  await prisma.savedJob.deleteMany({ where: { userId, jobId } });
}

export async function runScheduledSearch() {
  const users = await prisma.jobPreference.findMany({
    where: { autoSearchEnabled: true },
    select: { userId: true },
  });
  for (const row of users) {
    await enqueue("job-discovery", "search", { userId: row.userId }, {
      correlationId: row.userId,
      idempotencyKey: `job-discovery:search:${row.userId}:scheduled`,
    });
  }
}
