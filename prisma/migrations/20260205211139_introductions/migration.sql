-- AlterTable
ALTER TABLE "workspaceMember" ADD COLUMN     "introMessage" TEXT,
ADD COLUMN     "artistName" TEXT,
ADD COLUMN     "artwork" TEXT,
ADD COLUMN     "previewUrl" TEXT,
ADD COLUMN     "trackId" TEXT,
ADD COLUMN     "trackName" TEXT;

-- CreateIndex
CREATE INDEX "ActivityAdjustment_workspaceGroupId_createdAt_archived_idx" ON "ActivityAdjustment"("workspaceGroupId", "createdAt", "archived");

-- CreateIndex
CREATE INDEX "ActivitySession_workspaceGroupId_startTime_archived_idx" ON "ActivitySession"("workspaceGroupId", "startTime", "archived");

-- CreateIndex
CREATE INDEX "ActivitySession_workspaceGroupId_active_archived_idx" ON "ActivitySession"("workspaceGroupId", "active", "archived");

-- CreateIndex
CREATE INDEX "ActivitySession_userId_workspaceGroupId_idx" ON "ActivitySession"("userId", "workspaceGroupId");

-- CreateIndex
CREATE INDEX "Session_sessionTypeId_date_idx" ON "Session"("sessionTypeId", "date");

-- CreateIndex
CREATE INDEX "document_workspaceGroupId_isTrainingDocument_idx" ON "document"("workspaceGroupId", "isTrainingDocument");

-- CreateIndex
CREATE INDEX "inactivityNotice_workspaceGroupId_endTime_startTime_approve_idx" ON "inactivityNotice"("workspaceGroupId", "endTime", "startTime", "approved", "reviewed");

-- CreateIndex
CREATE INDEX "inactivityNotice_workspaceGroupId_userId_idx" ON "inactivityNotice"("workspaceGroupId", "userId");

-- CreateIndex
CREATE INDEX "user_birthdayMonth_birthdayDay_idx" ON "user"("birthdayMonth", "birthdayDay");

-- CreateIndex
CREATE INDEX "wallPost_workspaceGroupId_createdAt_idx" ON "wallPost"("workspaceGroupId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "workspaceMember_workspaceGroupId_joinDate_idx" ON "workspaceMember"("workspaceGroupId", "joinDate");
