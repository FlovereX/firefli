-- AlterTable
ALTER TABLE "Quota" ADD COLUMN     "completionType" TEXT DEFAULT 'auto',
ALTER COLUMN "value" DROP NOT NULL;

-- CreateTable
CREATE TABLE "UserQuotaCompletion" (
    "id" UUID NOT NULL,
    "quotaId" UUID NOT NULL,
    "userId" BIGINT NOT NULL,
    "workspaceGroupId" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedBy" BIGINT,
    "notes" TEXT,

    CONSTRAINT "UserQuotaCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserQuotaCompletion_userId_workspaceGroupId_idx" ON "UserQuotaCompletion"("userId", "workspaceGroupId");

-- CreateIndex
CREATE INDEX "UserQuotaCompletion_quotaId_idx" ON "UserQuotaCompletion"("quotaId");

-- CreateIndex
CREATE UNIQUE INDEX "UserQuotaCompletion_quotaId_userId_workspaceGroupId_key" ON "UserQuotaCompletion"("quotaId", "userId", "workspaceGroupId");

-- AddForeignKey
ALTER TABLE "UserQuotaCompletion" ADD CONSTRAINT "UserQuotaCompletion_quotaId_fkey" FOREIGN KEY ("quotaId") REFERENCES "Quota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuotaCompletion" ADD CONSTRAINT "UserQuotaCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("userid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuotaCompletion" ADD CONSTRAINT "UserQuotaCompletion_completedBy_fkey" FOREIGN KEY ("completedBy") REFERENCES "user"("userid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuotaCompletion" ADD CONSTRAINT "UserQuotaCompletion_workspaceGroupId_fkey" FOREIGN KEY ("workspaceGroupId") REFERENCES "workspace"("groupId") ON DELETE RESTRICT ON UPDATE CASCADE;
