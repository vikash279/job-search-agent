import { parseResumeJob } from "../modules/resume/service.js";
import { persistJobs, runScheduledSearch, searchAndIngest } from "../modules/job-discovery/service.js";
import { normalizeJob } from "../modules/job-source-adapters/normalize.js";
import type { NormalizedJob } from "../modules/job-source-adapters/types.js";
import { matchJobForUser, matchUnscoredJobs } from "../modules/job-matching/service.js";
import { prepareApplication } from "../modules/application-preparation/service.js";
import { startAssistedApplication } from "../modules/application-execution/service.js";
import type { QueueName } from "./index.js";

type Handler = (payload: Record<string, unknown>, correlationId: string) => Promise<void>;

export const handlers: Record<QueueName, Record<string, Handler>> = {
  "cv-parsing": {
    "parse-resume": async (payload) => {
      await parseResumeJob(String(payload.resumeId), String(payload.userId));
    },
  },
  "job-discovery": {
    search: async (payload) => {
      await searchAndIngest(String(payload.userId), {
        keywords: Array.isArray(payload.keywords) ? payload.keywords.map(String) : [],
        locations: Array.isArray(payload.locations) ? payload.locations.map(String) : undefined,
        remoteOnly: Boolean(payload.remoteOnly),
        page: Number(payload.page ?? 1),
      });
    },
    "scheduled-search": async () => {
      await runScheduledSearch();
    },
  },
  "job-normalization": {
    persist: async (payload) => {
      const raw = Array.isArray(payload.jobs) ? (payload.jobs as NormalizedJob[]) : [];
      const jobs = raw.map((job) =>
        normalizeJob({
          ...job,
          postedAt: job.postedAt ? new Date(job.postedAt) : undefined,
        }),
      );
      await persistJobs(jobs);
    },
  },
  "job-matching": {
    "match-job": async (payload) => {
      await matchJobForUser(String(payload.userId), String(payload.jobId));
    },
    "bulk-match": async (payload) => {
      await matchUnscoredJobs(String(payload.userId));
    },
  },
  "application-preparation": {
    prepare: async (payload) => {
      await prepareApplication(String(payload.userId), String(payload.jobId));
    },
  },
  "application-execution": {
    start: async (payload) => {
      await startAssistedApplication(String(payload.userId), String(payload.applicationId));
    },
  },
  "application-tracking": {},
  notifications: {},
};
