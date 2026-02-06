-- AlterTable
ALTER TABLE "SavedView" ADD COLUMN     "createdBy" BIGINT,
ADD COLUMN     "isLocal" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "SavedView_createdBy_idx" ON "SavedView"("createdBy");

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("userid") ON DELETE SET NULL ON UPDATE CASCADE;
