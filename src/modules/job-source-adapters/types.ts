import { z } from "zod";

export const jobSearchParamsSchema = z.object({
  keywords: z.array(z.string()),
  locations: z.array(z.string()).optional(),
  remoteOnly: z.boolean().optional(),
  postedWithinDays: z.number().int().min(1).max(90).optional(),
  page: z.number().int().min(1).optional(),
});

export const normalizedJobSchema = z.object({
  externalId: z.string().optional(),
  canonicalUrl: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional(),
  workMode: z.enum(["remote", "hybrid", "onsite"]).optional(),
  employmentType: z.string().optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  salaryCurrency: z.string().optional(),
  description: z.string(),
  requirements: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  postedAt: z.date().optional(),
  source: z.string().min(1),
  raw: z.unknown().optional(),
});

export type JobSearchParams = z.infer<typeof jobSearchParamsSchema>;
export type NormalizedJob = z.infer<typeof normalizedJobSchema>;

export interface JobSourceAdapter {
  readonly source: string;
  search(params: JobSearchParams): Promise<NormalizedJob[]>;
  getJob?(externalId: string): Promise<NormalizedJob | null>;
  supportsApplication(): boolean;
}
