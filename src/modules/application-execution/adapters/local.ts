import { checkpointsFromMapping, mapFormFields } from "../mapping.js";
import { publicMappedFields } from "../redact.js";
import type {
  ExecutionContext,
  LocalFormDefinition,
  PortalApplicationAdapter,
} from "../types.js";

export const DEFAULT_LOCAL_FORM: LocalFormDefinition = {
  id: "harbor-local-ats",
  source: "fixture",
  title: "Harbor local ATS fixture",
  fields: [
    { key: "name", label: "Full name", kind: "name", required: true },
    { key: "email", label: "Email", kind: "email", required: true },
    { key: "cover_letter", label: "Cover letter", kind: "cover_letter", required: true },
    { key: "notice_period", label: "Notice period", kind: "notice_period", required: false },
    { key: "expected_salary", label: "Expected salary", kind: "expected_salary", required: false },
    { key: "work_authorization", label: "Work authorization", kind: "work_authorization", required: true },
    { key: "sponsorship", label: "Visa sponsorship", kind: "sponsorship", required: true },
    { key: "relocation", label: "Relocation", kind: "relocation", required: true },
    { key: "captcha", label: "CAPTCHA", kind: "captcha", required: true },
  ],
  requiredCheckpoints: ["login", "captcha"],
};

export const OPEN_LOCAL_FORM: LocalFormDefinition = {
  ...DEFAULT_LOCAL_FORM,
  id: "harbor-local-open",
  title: "Harbor local form without human gates",
  fields: DEFAULT_LOCAL_FORM.fields.filter((field) => field.kind !== "captcha"),
  requiredCheckpoints: [],
};

/**
 * In-process mock adapter. It never talks to a real employer portal.
 * testedAgainstPortal is false on purpose — this is a local fixture only.
 */
export class LocalApplicationAdapter implements PortalApplicationAdapter {
  readonly source = "fixture";
  readonly testedAgainstPortal = false;

  constructor(private readonly form: LocalFormDefinition = DEFAULT_LOCAL_FORM) {}

  supports(input: { source: string }): boolean {
    return input.source === "fixture" || input.source === "local";
  }

  async apply(ctx: ExecutionContext) {
    const form = ctx.form ?? this.form;
    const mapped = mapFormFields(form, ctx);
    const checkpoints = checkpointsFromMapping(form, mapped, ctx.completedCheckpoints);
    const applicationUrl = form.applicationUrl || ctx.application.job.canonicalUrl;

    if (checkpoints.length) {
      return {
        status: "REQUIRES_USER_ACTION" as const,
        adapter: this.source,
        testedAgainstPortal: this.testedAgainstPortal,
        applicationUrl,
        message:
          "Harbor mapped verified fields onto a local fixture form and paused. Complete login, CAPTCHA, OTP, or MFA yourself. Nothing was submitted.",
        mappedFields: publicMappedFields(mapped),
        checkpoints,
        retryable: true,
      };
    }

    return {
      status: "READY_FOR_SUBMISSION" as const,
      adapter: this.source,
      testedAgainstPortal: this.testedAgainstPortal,
      applicationUrl,
      message:
        "Verified fields were copied into the local fixture form. Harbor did not submit. Confirm only after you send the application yourself.",
      mappedFields: publicMappedFields(mapped),
      checkpoints: [
        {
          reason: "manual_submit" as const,
          message: "Submission still requires your explicit confirmation.",
        },
      ],
      retryable: false,
    };
  }
}
