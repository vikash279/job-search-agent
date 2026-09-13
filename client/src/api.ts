const TOKEN_KEY = "harbor.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(path, { ...options, headers });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Request failed (${response.status})`);
  }
  return data as T;
}

export const client = {
  register: (body: { email: string; name: string; password: string }) =>
    api<{ token: string; user: { id: string; email: string; name: string } }>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    api<{ token: string; user: { id: string; email: string; name: string } }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  me: () => api<{ user: { id: string; email: string; name: string } }>("/api/v1/auth/me"),
  profile: () => api<{ profile: Record<string, unknown> }>("/api/v1/profile"),
  updateProfile: (body: Record<string, unknown>) =>
    api<{ profile: Record<string, unknown> }>("/api/v1/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  parseResume: (file: File, name?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (name) form.append("name", name);
    return api<{ resume: Record<string, unknown>; profile: Record<string, unknown> }>(
      "/api/v1/profile/parse-resume",
      { method: "POST", body: form },
    );
  },
  resumes: () => api<{ resumes: Array<Record<string, unknown>> }>("/api/v1/resumes"),
  uploadResume: (file: File, name?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (name) form.append("name", name);
    return api<{ resume: Record<string, unknown> }>("/api/v1/resumes", { method: "POST", body: form });
  },
  updateResume: (id: string, body: Record<string, unknown>) =>
    api(`/api/v1/resumes/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteResume: (id: string) => api(`/api/v1/resumes/${id}`, { method: "DELETE" }),
  preferences: () => api<{ preferences: Record<string, unknown> }>("/api/v1/preferences"),
  savePreferences: (body: Record<string, unknown>) =>
    api<{ preferences: Record<string, unknown> }>("/api/v1/preferences", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  searchPreview: () =>
    api<{ preview: Record<string, unknown> }>("/api/v1/preferences/search-preview", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  searchJobs: (body: Record<string, unknown>) =>
    api<{ count: number; jobs: unknown[] }>("/api/v1/jobs/search", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  jobs: (query = "") => api<{ items: JobCard[]; total: number }>(`/api/v1/jobs${query}`),
  job: (id: string) => api<{ job: JobDetail }>(`/api/v1/jobs/${id}`),
  matchJob: (id: string) => api<{ match: Match }>(`/api/v1/jobs/${id}/match`, { method: "POST" }),
  bulkMatch: () => api<{ matches: Match[] }>("/api/v1/jobs/bulk-match", { method: "POST" }),
  saveJob: (id: string) => api(`/api/v1/jobs/${id}/save`, { method: "POST" }),
  unsaveJob: (id: string) => api(`/api/v1/jobs/${id}/save`, { method: "DELETE" }),
  prepare: (jobId: string, resumeVersionId?: string) =>
    api<{ application: Application }>(`/api/v1/applications/prepare`, {
      method: "POST",
      body: JSON.stringify({ jobId, resumeVersionId }),
    }),
  applications: () => api<{ applications: Application[] }>("/api/v1/applications"),
  application: (id: string) => api<{ application: Application }>(`/api/v1/applications/${id}`),
  updateApplication: (id: string, body: Record<string, unknown>) =>
    api<{ application: Application }>(`/api/v1/applications/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  approve: (id: string) =>
    api<{ application: Application }>(`/api/v1/applications/${id}/approve`, { method: "POST" }),
  reject: (id: string) =>
    api<{ application: Application }>(`/api/v1/applications/${id}/reject`, { method: "POST" }),
  start: (id: string) =>
    api<{ execution: Execution }>(`/api/v1/applications/${id}/start`, { method: "POST" }),
  continueApply: (id: string, completedCheckpoints: string[] = []) =>
    api<{ execution: Execution }>(`/api/v1/applications/${id}/continue`, {
      method: "POST",
      body: JSON.stringify({ completedCheckpoints }),
    }),
  retryApply: (id: string) =>
    api<{ execution: Execution }>(`/api/v1/applications/${id}/retry`, { method: "POST" }),
  confirmSubmit: (id: string, applicationUrl?: string) =>
    api<{ application: Application }>(`/api/v1/applications/${id}/confirm-submit`, {
      method: "POST",
      body: JSON.stringify({ applicationUrl }),
    }),
  cancel: (id: string) =>
    api<{ application: Application }>(`/api/v1/applications/${id}/cancel`, { method: "POST" }),
  events: (id: string) => api<{ events: EventItem[] }>(`/api/v1/applications/${id}/events`),
  markSubmitted: (id: string, applicationUrl?: string) =>
    api<{ application: Application }>(`/api/v1/applications/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status: "SUBMITTED", applicationUrl }),
    }),
  tracking: () =>
    api<{ counts: Record<string, number>; recent: Application[] }>("/api/v1/tracking/summary"),
  notifications: () => api<{ notifications: NotificationItem[] }>("/api/v1/notifications"),
  settings: () => api<Record<string, unknown>>("/api/v1/settings"),
};

export interface Match {
  id: string;
  score: number;
  recommendation: string;
  matchedSkills: string[];
  missingSkills: string[];
  strengths: string[];
  concerns: string[];
  explanation: string;
}

export interface JobCard {
  id: string;
  title: string;
  company: string;
  location?: string;
  workMode?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  source?: string;
  postedAt?: string;
  skills: string[];
  match?: Match | null;
  applicationStatus?: string | null;
  saved?: boolean;
}

export interface JobDetail extends JobCard {
  description: string;
  requirements: string[];
  canonicalUrl: string;
  application?: Application | null;
}

export interface Application {
  id: string;
  jobId?: string;
  status: string;
  matchScore?: number;
  applicationUrl?: string;
  coverLetter?: string;
  tailoredResume?: string;
  tailoringNotes?: string[];
  errorMessage?: string;
  appliedAt?: string;
  updatedAt?: string;
  job?: JobCard & { description?: string; source?: { name: string } };
  resume?: { id: string; name: string; parsedText?: string | null };
  review?: {
    originalJobDescription?: string;
    originalJobTitle?: string;
    originalCompany?: string;
    selectedResumeName?: string | null;
    originalResumeText?: string | null;
    originalResumeFileKey?: string | null;
    fieldsRequiringReview: Array<{ fieldKey: string; question: string }>;
    canApprove: boolean;
  };
  answers?: Array<{
    id: string;
    fieldKey: string;
    question: string;
    answer: string;
    source: string;
    confidence: number;
    requiresReview: boolean;
  }>;
  events?: EventItem[];
  execution?: Execution | null;
}

export interface Execution {
  status: string;
  adapter?: string;
  testedAgainstPortal?: boolean;
  applicationUrl?: string;
  message: string;
  mappedFields?: Array<{
    key: string;
    label: string;
    kind: string;
    filled: boolean;
    requiresHuman: boolean;
    reason?: string;
  }>;
  checkpoints?: Array<{ reason: string; fieldKey?: string; message: string }>;
  retryable?: boolean;
  attempt?: number;
}

export interface EventItem {
  id: string;
  eventType: string;
  message: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}
