import { ForbiddenError, ValidationError } from "../../lib/errors.js";
import { verifyAnswerAgainstProfile } from "../application-preparation/answers.js";
import type { CandidateProfile } from "@prisma/client";
import type { ExecutionPackage } from "./types.js";

const STARTABLE = new Set(["APPROVED", "FAILED", "REQUIRES_USER_ACTION"]);

export function assertApprovedForExecution(
  application: ExecutionPackage,
  profile: CandidateProfile,
  options: { allowPaused?: boolean } = {},
) {
  const allowed = options.allowPaused
    ? STARTABLE
    : new Set(["APPROVED", "FAILED"]);
  if (!allowed.has(application.status)) {
    throw new ForbiddenError("Only an approved application can start execution");
  }
  if (application.status === "READY_FOR_SUBMISSION") {
    throw new ForbiddenError("This package is already ready. Confirm submission yourself if you sent it.");
  }
  if (application.status === "SUBMITTED") {
    throw new ForbiddenError("This application was already marked submitted");
  }

  const emptyReview = application.answers.filter((answer) => answer.requiresReview && !answer.answer.trim());
  if (emptyReview.length) {
    throw new ValidationError("Unresolved review answers block execution");
  }

  const invalid = application.answers
    .filter((answer) => answer.requiresReview && answer.answer.trim())
    .map((answer) => ({
      answer,
      check: verifyAnswerAgainstProfile(profile, answer.question, answer.answer, answer.source),
    }))
    .filter((item) => !item.check.ok);
  if (invalid.length) {
    throw new ValidationError(
      `Answers need review: ${invalid.map((item) => item.check.reason).join("; ")}`,
    );
  }

  if (!application.job.canonicalUrl) {
    throw new ValidationError("This job has no application URL");
  }
}
