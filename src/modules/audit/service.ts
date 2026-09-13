import { prisma } from "../../db/prisma.js";
import { asJson } from "../../lib/http.js";
import { sanitizeLogValue } from "../../lib/logger.js";

export async function writeAudit(input: {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata: asJson(sanitizeLogValue(input.metadata ?? {})),
      ip: input.ip,
    },
  });
}
