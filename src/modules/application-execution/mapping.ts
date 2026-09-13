import { asStringArray } from "../../lib/json.js";
import { classifyQuestion, type QuestionKind } from "../application-preparation/answers.js";
import type {
  ApplicationAnswerLike,
  ExecutionContext,
  FormFieldDefinition,
  FormFieldKind,
  HumanCheckpoint,
  LocalFormDefinition,
  MappedField,
} from "./types.js";

const KIND_TO_QUESTION: Partial<Record<FormFieldKind, QuestionKind>> = {
  work_authorization: "work_authorization",
  sponsorship: "sponsorship",
  current_salary: "current_salary",
  expected_salary: "expected_salary",
  relocation: "relocation",
  notice_period: "notice_period",
  legal: "legal",
  missing_experience: "missing_experience",
  skills: "skills",
};

const NEVER_AUTOFILL: FormFieldKind[] = ["captcha", "otp", "mfa", "login", "unknown"];
const USER_ONLY_KINDS: FormFieldKind[] = [
  "work_authorization",
  "sponsorship",
  "current_salary",
  "relocation",
  "legal",
  "missing_experience",
];

function verified(profile: ExecutionContext["profile"], field: string): boolean {
  return asStringArray(profile.verifiedFields).includes(field);
}

function findAnswer(field: FormFieldDefinition, answers: ApplicationAnswerLike[]): ApplicationAnswerLike | undefined {
  const byKey = answers.find((answer) => answer.fieldKey === field.key);
  if (byKey) return byKey;
  const expectedKind = KIND_TO_QUESTION[field.kind];
  return answers.find((answer) => classifyQuestion(answer.question) === expectedKind);
}

function userProvided(answer?: ApplicationAnswerLike): boolean {
  return Boolean(answer?.answer.trim() && (answer.source === "user_input" || answer.source === "profile"));
}

export function mapFormFields(form: LocalFormDefinition, ctx: ExecutionContext): MappedField[] {
  const skills = asStringArray(ctx.profile.skills);
  return form.fields.map((field) => {
    if (NEVER_AUTOFILL.includes(field.kind)) {
      return blank(field, "This step must be completed by the user");
    }

    const answer = findAnswer(field, ctx.application.answers);

    if (USER_ONLY_KINDS.includes(field.kind)) {
      if (userProvided(answer)) {
        return filled(field, answer!.answer, answer!.source === "profile" ? "profile" : "user_input");
      }
      return blank(field, "Harbor will not guess this answer");
    }

    if (field.kind === "name" && ctx.user.name.trim()) {
      return filled(field, ctx.user.name, "profile");
    }
    if (field.kind === "email" && ctx.user.email.trim()) {
      return filled(field, ctx.user.email, "profile");
    }
    if (field.kind === "headline" && ctx.profile.headline && verified(ctx.profile, "headline")) {
      return filled(field, ctx.profile.headline, "profile");
    }
    if (field.kind === "skills" && skills.length && verified(ctx.profile, "skills")) {
      return filled(field, skills.join(", "), "profile");
    }
    if (field.kind === "cover_letter" && ctx.application.coverLetter?.trim()) {
      return filled(field, ctx.application.coverLetter, "package");
    }
    if (field.kind === "tailored_resume" && ctx.application.tailoredResume?.trim()) {
      return filled(field, ctx.application.tailoredResume, "package");
    }
    if (field.kind === "resume" && ctx.application.resume?.fileKey) {
      return filled(field, ctx.application.resume.name, "resume");
    }
    if (
      field.kind === "notice_period" &&
      ctx.profile.noticePeriodDays != null &&
      verified(ctx.profile, "noticePeriodDays")
    ) {
      return filled(field, `${ctx.profile.noticePeriodDays} days`, "profile");
    }
    if (
      field.kind === "expected_salary" &&
      ctx.profile.expectedSalaryMin != null &&
      verified(ctx.profile, "expectedSalaryMin")
    ) {
      const max = ctx.profile.expectedSalaryMax ? `-${ctx.profile.expectedSalaryMax}` : "";
      return filled(
        field,
        `${ctx.profile.expectedSalaryMin}${max} ${ctx.profile.salaryCurrency ?? ""}`.trim(),
        "profile",
      );
    }
    if (userProvided(answer) && !USER_ONLY_KINDS.includes(field.kind)) {
      return filled(field, answer!.answer, answer!.source === "profile" ? "profile" : "user_input");
    }
    if (field.kind === "phone") {
      return blank(field, "Phone number is not a verified profile field");
    }
    return blank(field, "No verified value available");
  });
}

export function checkpointsFromMapping(
  form: LocalFormDefinition,
  mapped: MappedField[],
  completed: Iterable<string>,
): HumanCheckpoint[] {
  const done = new Set(completed);
  const checkpoints: HumanCheckpoint[] = [];

  for (const gate of form.requiredCheckpoints) {
    if (done.has(gate)) continue;
    checkpoints.push({
      reason: gate,
      message: humanGateMessage(gate),
    });
  }

  for (const field of mapped) {
    if (!field.requiresHuman) continue;
    const definition = form.fields.find((item) => item.key === field.key);
    if (field.kind === "captcha" || field.kind === "otp" || field.kind === "mfa" || field.kind === "login") {
      if (done.has(field.kind)) continue;
      checkpoints.push({
        reason: field.kind,
        fieldKey: field.key,
        message: field.reason ?? humanGateMessage(field.kind),
      });
      continue;
    }
    if (definition?.required === false) continue;
    checkpoints.push({
      reason: field.kind === "unknown" ? "unmapped_field" : "missing_verified_data",
      fieldKey: field.key,
      message: field.reason ?? `${field.label} needs you`,
    });
  }

  return uniqueCheckpoints(checkpoints);
}

function humanGateMessage(gate: string): string {
  switch (gate) {
    case "captcha":
      return "A CAPTCHA is present. Harbor will not solve or bypass it.";
    case "otp":
      return "A one-time code is required. Harbor will not read or store OTPs.";
    case "mfa":
      return "Multi-factor authentication is required. Complete it yourself.";
    case "login":
      return "Portal login is required. Harbor does not store passwords or session cookies.";
    case "anti_bot":
      return "An anti-bot check is present. Harbor will not bypass it.";
    default:
      return "This step requires you.";
  }
}

function filled(
  field: FormFieldDefinition,
  value: string,
  source: MappedField["source"],
): MappedField {
  return {
    key: field.key,
    label: field.label,
    kind: field.kind,
    value,
    source,
    filled: true,
    requiresHuman: false,
  };
}

function blank(field: FormFieldDefinition, reason: string): MappedField {
  return {
    key: field.key,
    label: field.label,
    kind: field.kind,
    value: "",
    source: "unmapped",
    filled: false,
    requiresHuman: true,
    reason,
  };
}

function uniqueCheckpoints(items: HumanCheckpoint[]): HumanCheckpoint[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.reason}:${item.fieldKey ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
