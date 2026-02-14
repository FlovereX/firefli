-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "discordChannelId" TEXT,
ADD COLUMN     "discordMessageId" TEXT,
ADD COLUMN     "lastDiscordStatus" TEXT;

-- AlterTable
ALTER TABLE "SessionTag" ADD COLUMN     "allowedTypes" TEXT[],
ALTER COLUMN "name" SET DATA TYPE TEXT,
ALTER COLUMN "color" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "DiscordIntegration" (
    "id" UUID NOT NULL,
    "workspaceGroupId" INTEGER NOT NULL,
    "botToken" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "guildName" TEXT,
    "channelId" TEXT NOT NULL,
    "channelName" TEXT,
    "birthdayChannelId" TEXT,
    "birthdayChannelName" TEXT,
    "enabledEvents" JSONB NOT NULL DEFAULT '[]',
    "birthdayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "embedTitle" TEXT,
    "embedColor" TEXT,
    "embedFooter" TEXT,
    "embedThumbnail" BOOLEAN NOT NULL DEFAULT true,
    "promotionEmbedTitle" TEXT,
    "promotionEmbedColor" TEXT,
    "promotionEmbedDescription" TEXT,
    "promotionEmbedFooter" TEXT,
    "demotionEmbedTitle" TEXT,
    "demotionEmbedColor" TEXT,
    "demotionEmbedDescription" TEXT,
    "demotionEmbedFooter" TEXT,
    "warningEmbedTitle" TEXT,
    "warningEmbedColor" TEXT,
    "warningEmbedDescription" TEXT,
    "warningEmbedFooter" TEXT,
    "terminationEmbedTitle" TEXT,
    "terminationEmbedColor" TEXT,
    "terminationEmbedDescription" TEXT,
    "terminationEmbedFooter" TEXT,
    "noticeSubmitEmbedTitle" TEXT,
    "noticeSubmitEmbedColor" TEXT,
    "noticeSubmitEmbedDescription" TEXT,
    "noticeSubmitEmbedFooter" TEXT,
    "noticeApprovalEmbedTitle" TEXT,
    "noticeApprovalEmbedColor" TEXT,
    "noticeApprovalEmbedDescription" TEXT,
    "noticeApprovalEmbedFooter" TEXT,
    "noticeDenialEmbedTitle" TEXT,
    "noticeDenialEmbedColor" TEXT,
    "noticeDenialEmbedDescription" TEXT,
    "noticeDenialEmbedFooter" TEXT,
    "birthdayEmbedTitle" TEXT,
    "birthdayEmbedColor" TEXT,
    "birthdayEmbedDescription" TEXT,
    "sessionChannelId" TEXT,
    "sessionChannelName" TEXT,
    "sessionNotifyOnCreate" BOOLEAN NOT NULL DEFAULT false,
    "sessionNotifyOnClaim" BOOLEAN NOT NULL DEFAULT false,
    "sessionNotifyOnStart" BOOLEAN NOT NULL DEFAULT false,
    "sessionEmbedTitle" TEXT,
    "sessionEmbedColor" TEXT,
    "sessionEmbedDescription" TEXT,
    "sessionEmbedFooter" TEXT,
    "sessionPingRoleId" TEXT,
    "sessionPingRoleName" TEXT,
    "pingRoles" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastMessageAt" TIMESTAMP(3),
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloxlinkIntegration" (
    "id" UUID NOT NULL,
    "workspaceGroupId" INTEGER NOT NULL,
    "apiKey" TEXT NOT NULL,
    "discordServerId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notifyPromotion" BOOLEAN NOT NULL DEFAULT true,
    "notifyDemotion" BOOLEAN NOT NULL DEFAULT true,
    "notifyWarning" BOOLEAN NOT NULL DEFAULT true,
    "messageTemplate" JSONB,
    "lastUsed" TIMESTAMP(3),
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BloxlinkIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SessionTagToSessionType" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_SessionTagToSessionType_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscordIntegration_workspaceGroupId_key" ON "DiscordIntegration"("workspaceGroupId");

-- CreateIndex
CREATE INDEX "DiscordIntegration_workspaceGroupId_idx" ON "DiscordIntegration"("workspaceGroupId");

-- CreateIndex
CREATE INDEX "DiscordIntegration_guildId_idx" ON "DiscordIntegration"("guildId");

-- CreateIndex
CREATE INDEX "DiscordIntegration_channelId_idx" ON "DiscordIntegration"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "BloxlinkIntegration_workspaceGroupId_key" ON "BloxlinkIntegration"("workspaceGroupId");

-- CreateIndex
CREATE INDEX "BloxlinkIntegration_workspaceGroupId_idx" ON "BloxlinkIntegration"("workspaceGroupId");

-- CreateIndex
CREATE INDEX "BloxlinkIntegration_discordServerId_idx" ON "BloxlinkIntegration"("discordServerId");

-- CreateIndex
CREATE INDEX "_SessionTagToSessionType_B_index" ON "_SessionTagToSessionType"("B");

-- AddForeignKey
ALTER TABLE "DiscordIntegration" ADD CONSTRAINT "DiscordIntegration_workspaceGroupId_fkey" FOREIGN KEY ("workspaceGroupId") REFERENCES "workspace"("groupId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloxlinkIntegration" ADD CONSTRAINT "BloxlinkIntegration_workspaceGroupId_fkey" FOREIGN KEY ("workspaceGroupId") REFERENCES "workspace"("groupId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SessionTagToSessionType" ADD CONSTRAINT "_SessionTagToSessionType_A_fkey" FOREIGN KEY ("A") REFERENCES "SessionTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SessionTagToSessionType" ADD CONSTRAINT "_SessionTagToSessionType_B_fkey" FOREIGN KEY ("B") REFERENCES "SessionType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
