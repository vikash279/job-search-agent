export const APPLICATION_STATES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "IN_PROGRESS",
  "REQUIRES_USER_ACTION",
  "READY_FOR_SUBMISSION",
  "SUBMITTED",
  "FAILED",
  "REJECTED",
  "WITHDRAWN",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATES)[number];

const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  DRAFT: ["PENDING_APPROVAL", "REJECTED", "WITHDRAWN"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED", "DRAFT", "WITHDRAWN"],
  APPROVED: ["IN_PROGRESS", "WITHDRAWN"],
  IN_PROGRESS: ["REQUIRES_USER_ACTION", "READY_FOR_SUBMISSION", "FAILED"],
  REQUIRES_USER_ACTION: ["IN_PROGRESS", "READY_FOR_SUBMISSION", "SUBMITTED", "WITHDRAWN", "FAILED"],
  READY_FOR_SUBMISSION: ["SUBMITTED", "FAILED", "WITHDRAWN"],
  SUBMITTED: ["WITHDRAWN"],
  FAILED: ["APPROVED", "WITHDRAWN"],
  REJECTED: [],
  WITHDRAWN: [],
};

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: string, to: ApplicationStatus) {
  if (!canTransition(from as ApplicationStatus, to)) {
    const error = new Error(`Cannot transition application from ${from} to ${to}`);
    error.name = "InvalidStateTransition";
    throw error;
  }
}
