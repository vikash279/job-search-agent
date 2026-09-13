import type { CandidateProfile } from "@prisma/client";
import { applicationPackageSchema, type ApplicationPackage } from "../../ai/schemas.js";
import { sanitizeGeneratedText, verifyAnswerAgainstProfile } from "./answers.js";

export function groundApplicationPackage(
  profile: CandidateProfile,
  pack: ApplicationPackage,
): ApplicationPackage {
  const answers = pack.answers.map((answer) => {
    const check = verifyAnswerAgainstProfile(profile, answer.question, answer.answer, answer.source);
    if (!check.ok) {
      return {
        ...answer,
        answer: "",
        requiresReview: true,
        confidence: Math.min(answer.confidence, 0.2),
      };
    }
    return answer;
  });

  return applicationPackageSchema.parse({
    coverLetter: sanitizeGeneratedText(profile, pack.coverLetter),
    tailoredResume: sanitizeGeneratedText(profile, pack.tailoredResume),
    tailoringNotes: pack.tailoringNotes,
    answers,
  });
}
