-- DropForeignKey
ALTER TABLE "rank" DROP CONSTRAINT "rank_userId_fkey";

-- DropForeignKey
ALTER TABLE "rank" DROP CONSTRAINT "rank_workspaceGroupId_fkey";

-- AlterTable
ALTER TABLE "workspace" ADD COLUMN     "ownerId" BIGINT;

-- AddForeignKey
ALTER TABLE "rank" ADD CONSTRAINT "rank_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("userid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rank" ADD CONSTRAINT "rank_workspaceGroupId_fkey" FOREIGN KEY ("workspaceGroupId") REFERENCES "workspace"("groupId") ON DELETE CASCADE ON UPDATE CASCADE;
