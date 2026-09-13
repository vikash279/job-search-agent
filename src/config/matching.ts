export const matchingWeights = {
  requiredSkills: 0.35,
  relevantExperience: 0.2,
  roleSeniority: 0.15,
  locationWorkMode: 0.15,
  salaryPreferences: 0.15,
} as const;

export const matchingThresholds = {
  apply: 75,
  review: 50,
} as const;

export const matchingVersions = {
  modelVersion: process.env.AI_MODEL || "heuristic-v1",
  promptVersion: "match-v1",
  parserPromptVersion: "cv-parse-v1",
  prepPromptVersion: "app-prep-v1",
} as const;

export type MatchingWeights = typeof matchingWeights;
