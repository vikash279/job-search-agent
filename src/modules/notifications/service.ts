import { prisma } from "../../db/prisma.js";
import { asJson } from "../../lib/http.js";

export async function notify(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      metadata: asJson(input.metadata ?? {}),
    },
  });
}

export async function listNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markRead(userId: string, id: string) {
  return prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
}
