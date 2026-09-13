import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { asJson } from "../../lib/http.js";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";
import { childLogger } from "../../lib/logger.js";
import { enqueue } from "../../queue/index.js";
import { deleteFile, readFileStream, storeFile } from "../../storage/index.js";
import { writeAudit } from "../audit/service.js";
import { applyParsedProfile } from "../candidate-profile/service.js";
import { assertResumeFile, extractResumeText } from "./extract-text.js";
import { parseResumeProfile } from "./parse-service.js";

export const updateResumeSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  isDefault: z.boolean().optional(),
});

export async function uploadResume(
  userId: string,
  file: Express.Multer.File,
  name?: string,
) {
  assertResumeFile(file, env.MAX_UPLOAD_MB * 1024 * 1024);
  const stored = await storeFile(file.buffer, file.originalname, file.mimetype, userId);
  const latest = await prisma.resumeVersion.findFirst({
    where: { userId },
    orderBy: { version: "desc" },
  });
  const count = latest?.version ?? 0;
  const isFirst = count === 0;

  const resume = await prisma.resumeVersion.create({
    data: {
      userId,
      name: name?.trim() || file.originalname,
      fileKey: stored.key,
      fileType: file.mimetype,
      version: count + 1,
      isDefault: isFirst,
    },
  });

  await enqueue("cv-parsing", "parse-resume", { resumeId: resume.id, userId }, {
    correlationId: resume.id,
    idempotencyKey: `cv-parsing:parse-resume:${resume.id}`,
  });
  await writeAudit({
    userId,
    action: "resume.upload",
    entity: "ResumeVersion",
    entityId: resume.id,
  });
  return resume;
}

export async function parseResumeJob(resumeId: string, userId: string) {
  const resume = await prisma.resumeVersion.findFirst({
    where: { id: resumeId, userId },
  });
  if (!resume) return;

  const { readFileBuffer } = await import("../../storage/index.js");
  const buffer = await readFileBuffer(resume.fileKey);
  const text = await extractResumeText(buffer, resume.fileType, resume.name);
  const parsed = await parseResumeProfile(text);

  await prisma.resumeVersion.update({
    where: { id: resume.id },
    data: { parsedText: text, parsedProfile: asJson(parsed) },
  });
  childLogger({ resumeId, userId }).info("Resume parsed; original file left unchanged");

  if (resume.isDefault) {
    await applyParsedProfile(userId, parsed);
  }
}

export async function listResumes(userId: string) {
  return prisma.resumeVersion.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { version: "desc" }],
    select: {
      id: true,
      name: true,
      fileType: true,
      isDefault: true,
      version: true,
      parsedProfile: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getResume(userId: string, id: string) {
  const resume = await prisma.resumeVersion.findFirst({ where: { id, userId } });
  if (!resume) throw new NotFoundError("Resume not found");
  return resume;
}

export async function updateResume(userId: string, id: string, input: z.infer<typeof updateResumeSchema>) {
  const resume = await getResume(userId, id);
  if (input.isDefault) {
    await prisma.resumeVersion.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
  }
  return prisma.resumeVersion.update({
    where: { id: resume.id },
    data: {
      name: input.name ?? resume.name,
      isDefault: input.isDefault ?? resume.isDefault,
    },
  });
}

export async function deleteResume(userId: string, id: string) {
  const resume = await getResume(userId, id);
  if (resume.isDefault) {
    throw new ForbiddenError("Set another resume as default before deleting this one");
  }
  await prisma.resumeVersion.delete({ where: { id } });
  await deleteFile(resume.fileKey);
}

export async function openResumeFile(userId: string, id: string) {
  const resume = await getResume(userId, id);
  return {
    resume,
    stream: await readFileStream(resume.fileKey),
  };
}

export async function assertOwnedFileKey(userId: string, key: string) {
  const resume = await prisma.resumeVersion.findFirst({
    where: { userId, fileKey: key },
    select: { id: true },
  });
  if (!resume) throw new ForbiddenError("You do not have access to this file");
}

export async function pickRelevantResume(userId: string, jobTitle: string, jobSkills: string[]) {
  const resumes = await prisma.resumeVersion.findMany({ where: { userId } });
  if (resumes.length === 0) return null;
  const scored = resumes.map((resume) => {
    const profile = (resume.parsedProfile ?? {}) as { skills?: string[]; headline?: string };
    const skills = (profile.skills ?? []).map((s) => s.toLowerCase());
    const overlap = jobSkills.filter((s) => skills.includes(s.toLowerCase())).length;
    const titleHit = (profile.headline ?? "").toLowerCase().includes(jobTitle.toLowerCase()) ? 2 : 0;
    return { resume, score: overlap + titleHit + (resume.isDefault ? 1 : 0) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.resume ?? null;
}
