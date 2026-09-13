import type { CandidateProfile } from "@prisma/client";
import { asStringArray } from "../../lib/json.js";
import type { ApplicationPackage } from "../../ai/schemas.js";

export type QuestionKind =
  | "work_authorization"
  | "sponsorship"
  | "current_salary"
  | "expected_salary"
  | "relocation"
  | "notice_period"
  | "missing_experience"
  | "legal"
  | "skills"
  | "general";

export interface ExtractedQuestion {
  fieldKey: string;
  question: string;
  kind: QuestionKind;
}

const KIND_PATTERNS: Array<[QuestionKind, RegExp]> = [
  ["sponsorship", /sponsor|visa/i],
  ["work_authorization", /authoriz|citizenship|legally allowed to work|work permit/i],
  ["current_salary", /current salary|currently earn|present ctc|current compensation/i],
  ["expected_salary", /expected salary|salary expectation|desired salary|compensation expectation/i],
  ["relocation", /relocat/i],
  ["notice_period", /notice period|when can you start|joining date|available to start/i],
  ["missing_experience", /years of experience|have you (ever )?(used|worked|built)|do you have experience/i],
  ["legal", /criminal|disability|race|gender|conviction/i],
  ["skills", /which skills|your skills|technical skills/i],
];

export function classifyQuestion(question: string): QuestionKind {
  for (const [kind, pattern] of KIND_PATTERNS) {
    if (pattern.test(question)) return kind;
  }
  return "general";
}

export function extractQuestions(description: string): ExtractedQuestion[] {
  const fromJob = description
    .split(/\n|\?/)
    .map((line) => line.trim())
    .filter((line) => line.length > 8 && /you|your|are you|do you|have you|will you/i.test(line))
    .slice(0, 8)
    .map((question, index) => {
      const text = question.endsWith("?") ? question : `${question}?`;
      return { fieldKey: `q_${index + 1}`, question: text, kind: classifyQuestion(text) };
    });

  const defaults: ExtractedQuestion[] = [
    { fieldKey: "work_authorization", question: "Are you legally authorized to work in the job location?", kind: "work_authorization" },
    { fieldKey: "sponsorship", question: "Will you require visa sponsorship now or in the future?", kind: "sponsorship" },
    { fieldKey: "notice_period", question: "What is your notice period?", kind: "notice_period" },
    { fieldKey: "expected_salary", question: "What is your expected salary?", kind: "expected_salary" },
    { fieldKey: "relocation", question: "Are you willing to relocate if required?", kind: "relocation" },
  ];

  if (/years? (of )?experience|experience required/i.test(description)) {
    defaults.unshift({
      fieldKey: "missing_experience",
      question: "Do you meet the years of experience required for this role?",
      kind: "missing_experience",
    });
  }

  const seen = new Set<string>();
  return [...fromJob, ...defaults]
    .filter((item) => {
      const key = item.question.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

function verified(profile: CandidateProfile, field: string): boolean {
  return asStringArray(profile.verifiedFields).includes(field);
}

function reviewAnswer(item: ExtractedQuestion, extras: Partial<ApplicationPackage["answers"][number]> = {}) {
  return {
    fieldKey: item.fieldKey,
    question: item.question,
    answer: "",
    source: "generated" as const,
    confidence: 0.1,
    requiresReview: true,
    ...extras,
  };
}

export function draftAnswers(
  profile: CandidateProfile,
  questions: ExtractedQuestion[],
): ApplicationPackage["answers"] {
  return questions.map((item) => {
    const kind = item.kind || classifyQuestion(item.question);

    if (kind === "notice_period" && profile.noticePeriodDays != null && verified(profile, "noticePeriodDays")) {
      return reviewAnswer(item, {
        answer: `${profile.noticePeriodDays} days`,
        source: "profile",
        confidence: 0.95,
        requiresReview: false,
      });
    }

    if (
      kind === "expected_salary" &&
      profile.expectedSalaryMin != null &&
      verified(profile, "expectedSalaryMin")
    ) {
      const max = profile.expectedSalaryMax ? `-${profile.expectedSalaryMax}` : "";
      return reviewAnswer(item, {
        answer: `${profile.expectedSalaryMin}${max} ${profile.salaryCurrency ?? ""}`.trim(),
        source: "profile",
        confidence: 0.9,
        requiresReview: false,
      });
    }

    if (
      kind === "work_authorization" ||
      kind === "sponsorship" ||
      kind === "current_salary" ||
      kind === "relocation" ||
      kind === "legal" ||
      kind === "missing_experience"
    ) {
      return reviewAnswer(item);
    }

    if (kind === "skills" || kind === "general") {
      const skills = asStringArray(profile.skills).slice(0, 8).join(", ");
      if (kind === "skills" && skills) {
        return reviewAnswer(item, {
          answer: `Verified skills from profile: ${skills}. Additional claims were not invented.`,
          source: "profile",
          confidence: 0.7,
          requiresReview: false,
        });
      }
    }

    return reviewAnswer(item);
  });
}

export function verifyAnswerAgainstProfile(
  profile: CandidateProfile,
  question: string,
  answer: string,
  source: string = "generated",
): { ok: boolean; reason?: string } {
  if (!answer.trim()) return { ok: true };
  const kind = classifyQuestion(question);
  const skills = asStringArray(profile.skills).map((item) => item.toLowerCase());
  const experience = JSON.stringify(profile.experience ?? []).toLowerCase();
  const education = JSON.stringify(profile.education ?? []).toLowerCase();
  const certifications = asStringArray(profile.certifications).map((item) => item.toLowerCase());
  const lower = answer.toLowerCase();

  if (source === "user_input") {
    return { ok: true };
  }

  if (kind === "current_salary") {
    return { ok: false, reason: "Current salary must be provided by the user" };
  }
  if (kind === "sponsorship" || kind === "work_authorization" || kind === "relocation" || kind === "legal") {
    return { ok: false, reason: "This question cannot be auto-answered" };
  }
  if (kind === "expected_salary" && (profile.expectedSalaryMin == null || !verified(profile, "expectedSalaryMin"))) {
    return { ok: false, reason: "Expected salary is not a verified profile field" };
  }
  if (kind === "notice_period" && (profile.noticePeriodDays == null || !verified(profile, "noticePeriodDays"))) {
    return { ok: false, reason: "Notice period is not a verified profile field" };
  }
  if (/\$\d|\d{2,3},\d{3}/.test(answer) && (profile.expectedSalaryMin == null || !verified(profile, "expectedSalaryMin"))) {
    return { ok: false, reason: "Salary is not a verified profile field" };
  }
  if (/\bcertified\b/i.test(answer) && !certifications.some((item) => lower.includes(item))) {
    return { ok: false, reason: "Certification is not in the verified profile" };
  }
  if (kind === "missing_experience") {
    return { ok: false, reason: "Experience claims for missing requirements need user review" };
  }
  const claimedEmployer = answer.match(/\bat\s+([A-Z][\w&. -]{2,})/);
  if (claimedEmployer?.[1] && !experience.includes(claimedEmployer[1].toLowerCase()) && !education.includes(claimedEmployer[1].toLowerCase())) {
    return { ok: false, reason: "Employer is not in the verified profile" };
  }
  if (/\bexpert in\b/i.test(answer) && !skills.some((skill) => lower.includes(skill))) {
    return { ok: false, reason: "Answer may introduce unverified skill claims" };
  }
  return { ok: true };
}

export function sanitizeGeneratedText(profile: CandidateProfile, text: string): string {
  const skills = asStringArray(profile.skills);
  if (!text.trim()) return text;
  if (/\$\d|\d{2,3},\d{3}/.test(text) && (profile.expectedSalaryMin == null || !verified(profile, "expectedSalaryMin"))) {
    return text.replace(/\$\s?\d[\d,]*(?:\s*[-–]\s*\$?\d[\d,]*)?/g, "[salary not verified]");
  }
  if (skills.length === 0) return text;
  return text;
}
