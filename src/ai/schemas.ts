import { z } from "zod";

export const experienceSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  current: z.boolean().optional(),
  highlights: z.array(z.string()).default([]),
});

export const educationSchema = z.object({
  school: z.string(),
  degree: z.string().optional(),
  field: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const projectSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  technologies: z.array(z.string()).default([]),
});

export const parsedProfileSchema = z.object({
  headline: z.string().optional(),
  summary: z.string().optional(),
  yearsExperience: z.number().optional(),
  currentTitle: z.string().optional(),
  currentCompany: z.string().optional(),
  skills: z.array(z.string()).default([]),
  experience: z.array(experienceSchema).default([]),
  education: z.array(educationSchema).default([]),
  achievements: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  projects: z.array(projectSchema).default([]),
  preferredRoles: z.array(z.string()).default([]),
  preferredLocations: z.array(z.string()).default([]),
  preferredWorkModes: z.array(z.string()).default([]),
  noticePeriodDays: z.number().int().optional(),
  expectedSalaryMin: z.number().int().optional(),
  expectedSalaryMax: z.number().int().optional(),
  salaryCurrency: z.string().optional(),
});

export type ParsedProfile = z.infer<typeof parsedProfileSchema>;

export const matchResultSchema = z.object({
  score: z.number().min(0).max(100),
  recommendation: z.enum(["apply", "review", "skip"]),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  strengths: z.array(z.string()),
  concerns: z.array(z.string()),
  explanation: z.string(),
});

export type MatchResult = z.infer<typeof matchResultSchema>;

export const applicationAnswerDraftSchema = z.object({
  fieldKey: z.string(),
  question: z.string(),
  answer: z.string(),
  source: z.enum(["profile", "resume", "user_input", "generated"]),
  confidence: z.number().min(0).max(1),
  requiresReview: z.boolean(),
});

export const applicationPackageSchema = z.object({
  coverLetter: z.string(),
  tailoredResume: z.string(),
  tailoringNotes: z.array(z.string()),
  answers: z.array(applicationAnswerDraftSchema),
});

export type ApplicationPackage = z.infer<typeof applicationPackageSchema>;
