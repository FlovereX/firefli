/*
  Warnings:

  - A unique constraint covering the columns `[quotaId,userId,workspaceGroupId,archived]` on the table `UserQuotaCompletion` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "UserQuotaCompletion_quotaId_userId_workspaceGroupId_key";

-- AlterTable
ALTER TABLE "UserQuotaCompletion" ADD COLUMN     "archiveEndDate" TIMESTAMP(3),
ADD COLUMN     "archiveStartDate" TIMESTAMP(3),
ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "UserQuotaCompletion_quotaId_userId_workspaceGroupId_archive_key" ON "UserQuotaCompletion"("quotaId", "userId", "workspaceGroupId", "archived");
