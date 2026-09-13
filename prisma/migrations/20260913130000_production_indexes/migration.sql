-- CreateIndex
CREATE UNIQUE INDEX "ResumeVersion_fileKey_key" ON "ResumeVersion"("fileKey");

-- CreateIndex
CREATE INDEX "ResumeVersion_userId_isDefault_idx" ON "ResumeVersion"("userId", "isDefault");

-- CreateIndex
CREATE INDEX "Application_userId_appliedAt_idx" ON "Application"("userId", "appliedAt");

-- AlterTable
ALTER TABLE "QueueJob" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE INDEX "QueueJob_idempotencyKey_status_idx" ON "QueueJob"("idempotencyKey", "status");

-- CreateIndex
CREATE INDEX "QueueJob_status_lockedAt_idx" ON "QueueJob"("status", "lockedAt");
