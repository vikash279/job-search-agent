import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { ConflictError, UnauthorizedError } from "../../lib/errors.js";
import { signToken } from "../../middleware/auth.js";
import { writeAudit } from "../audit/service.js";

export const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(72),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function register(input: z.infer<typeof registerSchema>, ip?: string) {
  const email = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError("An account with that email already exists");

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      name: input.name.trim(),
      passwordHash,
      profile: { create: {} },
      preferences: { create: {} },
    },
  });

  await writeAudit({
    userId: user.id,
    action: "user.register",
    entity: "User",
    entityId: user.id,
    ip,
  });

  return {
    user: { id: user.id, email: user.email, name: user.name },
    token: signToken({ id: user.id, email: user.email }),
  };
}

export async function login(input: z.infer<typeof loginSchema>, ip?: string) {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
  });
  if (!user) throw new UnauthorizedError("Invalid email or password");
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new UnauthorizedError("Invalid email or password");
  await writeAudit({
    userId: user.id,
    action: "user.login",
    entity: "User",
    entityId: user.id,
    ip,
  });
  return {
    user: { id: user.id, email: user.email, name: user.name },
    token: signToken({ id: user.id, email: user.email }),
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  if (!user) throw new UnauthorizedError();
  return user;
}
