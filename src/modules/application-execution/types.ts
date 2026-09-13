import type { CandidateProfile } from "@prisma/client";

export const HUMAN_GATES = ["captcha", "otp", "mfa", "login", "anti_bot"] as const;
export type HumanGate = (typeof HUMAN_GATES)[number];

export type HumanCheckpointReason =
  | HumanGate
  | "unmapped_field"
  | "ambiguous_answer"
  | "missing_verified_data"
  | "manual_submit"
  | "rate_limited";

export type FormFieldKind =
  | "name"
  | "email"
  | "phone"
  | "headline"
  | "skills"
  | "cover_letter"
  | "tailored_resume"
  | "resume"
  | "work_authorization"
  | "sponsorship"
  | "current_salary"
  | "expected_salary"
  | "relocation"
  | "notice_period"
  | "legal"
  | "missing_experience"
  | "captcha"
  | "otp"
  | "mfa"
  | "login"
  | "unknown";

export const SENSITIVE_FIELD_KINDS = new Set<FormFieldKind>([
  "current_salary",
  "expected_salary",
  "work_authorization",
  "sponsorship",
  "relocation",
  "legal",
  "otp",
  "mfa",
  "login",
  "captcha",
]);

export interface FormFieldDefinition {
  key: string;
  label: string;
  kind: FormFieldKind;
  required?: boolean;
}

export interface LocalFormDefinition {
  id: string;
  source: string;
  title: string;
  applicationUrl?: string;
  fields: FormFieldDefinition[];
  requiredCheckpoints: HumanGate[];
}

export interface MappedField {
  key: string;
  label: string;
  kind: FormFieldKind;
  value: string;
  source: "profile" | "resume" | "user_input" | "package" | "unmapped";
  filled: boolean;
  requiresHuman: boolean;
  reason?: string;
}

export interface HumanCheckpoint {
  reason: HumanCheckpointReason;
  fieldKey?: string;
  message: string;
}

export interface ExecutionResult {
  status: "REQUIRES_USER_ACTION" | "READY_FOR_SUBMISSION" | "FAILED";
  adapter: string;
  testedAgainstPortal: boolean;
  applicationUrl?: string;
  message: string;
  mappedFields: Array<{
    key: string;
    label: string;
    kind: FormFieldKind;
    filled: boolean;
    requiresHuman: boolean;
    reason?: string;
  }>;
  checkpoints: HumanCheckpoint[];
  retryable: boolean;
  attempt: number;
}

export interface ApplicationAnswerLike {
  fieldKey: string;
  question: string;
  answer: string;
  source: string;
  requiresReview: boolean;
}

export interface ExecutionPackage {
  id: string;
  status: string;
  coverLetter?: string | null;
  tailoredResume?: string | null;
  applicationUrl?: string | null;
  resume?: { name: string; fileKey: string } | null;
  job: { title: string; company: string; canonicalUrl: string; source?: { name: string } | null };
  answers: ApplicationAnswerLike[];
}

export interface ExecutionContext {
  user: { id: string; email: string; name: string };
  profile: CandidateProfile;
  application: ExecutionPackage;
  form?: LocalFormDefinition;
  completedCheckpoints: HumanGate[];
}

export interface PortalApplicationAdapter {
  readonly source: string;
  readonly testedAgainstPortal: boolean;
  supports(input: { source: string; canonicalUrl: string }): boolean;
  apply(ctx: ExecutionContext): Promise<Omit<ExecutionResult, "attempt">>;
}
