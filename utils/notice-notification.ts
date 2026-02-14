import prisma from './database';
import { BloxlinkAPI, decryptApiKey } from './bloxlink';
import { decryptToken } from './discord';

export async function sendNoticeNotification(
  workspaceGroupId: number,
  userId: number,
  noticeType: 'submit' | 'approval' | 'denial',
  noticeDetails: {
    id: string;
    startTime: Date;
    endTime?: Date | null;
    reason: string;
    reviewComment?: string | null;
    reviewedBy?: string | null;
  }
) {
  try {
    // Get Bloxlink integration
    const bloxlinkIntegration = await prisma.bloxlinkIntegration.findUnique({
      where: { workspaceGroupId },
    });

    if (!bloxlinkIntegration || !bloxlinkIntegration.isActive) {
      console.log(`[NoticeNotification] Bloxlink integration not found or inactive for workspace ${workspaceGroupId}`);
      return;
    }

    // Get Discord integration for embed templates and bot token
    const discordIntegration = await prisma.discordIntegration.findUnique({
      where: { workspaceGroupId },
    });

    if (!discordIntegration) {
      console.log(`[NoticeNotification] Discord integration not found for workspace ${workspaceGroupId}`);
      return;
    }

    // Get workspace name
    const workspace = await prisma.workspace.findUnique({
      where: { groupId: workspaceGroupId },
      select: { groupName: true }
    });

    if (!workspace) {
      console.error('[NoticeNotification] Workspace not found:', workspaceGroupId);
      return;
    }

    // Get reviewer username if provided
    let reviewedByName = noticeDetails.reviewedBy || 'System';
    if (noticeDetails.reviewedBy) {
      try {
        const reviewer = await prisma.user.findUnique({
          where: { userid: BigInt(noticeDetails.reviewedBy) },
          select: { username: true }
        });
        reviewedByName = reviewer?.username || noticeDetails.reviewedBy;
      } catch (e) {
        console.error('[NoticeNotification] Failed to get reviewer username:', e);
      }
    }

    // Initialize Bloxlink API
    const decryptedApiKey = decryptApiKey(bloxlinkIntegration.apiKey);
    const bloxlink = new BloxlinkAPI(decryptedApiKey, bloxlinkIntegration.discordServerId);

    // Lookup Discord user
    const lookupResult = await bloxlink.lookupUserByRobloxId(userId);

    if (!lookupResult.success || !lookupResult.user?.primaryDiscordID) {
      console.log(`[NoticeNotification] User ${userId} not found in Discord server ${bloxlinkIntegration.discordServerId}`);
      return;
    }

    // Get target user info
    const targetUser = await prisma.user.findUnique({
      where: { userid: BigInt(userId) },
      select: { username: true }
    });
    const targetUsername = targetUser?.username || String(userId);

    // Helper function to replace template variables
    const replaceVariables = (template: string) => {
      return template
        .replace(/\{username\}/g, targetUsername)
        .replace(/\{userId\}/g, String(userId))
        .replace(/\{workspace\}/g, workspace.groupName || 'Workspace')
        .replace(/\{reason\}/g, noticeDetails.reason || 'No reason provided')
        .replace(/\{reviewedBy\}/g, reviewedByName)
        .replace(/\{reviewComment\}/g, noticeDetails.reviewComment || 'No comment provided')
        .replace(/\{startDate\}/g, noticeDetails.startTime.toLocaleDateString())
        .replace(/\{endDate\}/g, noticeDetails.endTime ? noticeDetails.endTime.toLocaleDateString() : 'Not specified')
        .replace(/\{noticeId\}/g, noticeDetails.id);
    };

    // Get custom templates for this notice type
    const customTitle = {
      submit: discordIntegration.noticeSubmitEmbedTitle,
      approval: discordIntegration.noticeApprovalEmbedTitle,
      denial: discordIntegration.noticeDenialEmbedTitle
    };

    const customColor = {
      submit: discordIntegration.noticeSubmitEmbedColor,
      approval: discordIntegration.noticeApprovalEmbedColor,
      denial: discordIntegration.noticeDenialEmbedColor
    };

    const customDescription = {
      submit: discordIntegration.noticeSubmitEmbedDescription,
      approval: discordIntegration.noticeApprovalEmbedDescription,
      denial: discordIntegration.noticeDenialEmbedDescription
    };

    const customFooter = {
      submit: discordIntegration.noticeSubmitEmbedFooter,
      approval: discordIntegration.noticeApprovalEmbedFooter,
      denial: discordIntegration.noticeDenialEmbedFooter
    };

    // Default values if no custom templates
    const defaultEmoji = {
      submit: '📝',
      approval: '✅',
      denial: '❌'
    };

    const defaultColor = {
      submit: 0x3b82f6,  // Blue
      approval: 0x10b981, // Green
      denial: 0xef4444   // Red
    };

    const defaultTitle = `${defaultEmoji[noticeType]} ${
      noticeType === 'submit' ? 'Notice Submitted' :
      noticeType === 'approval' ? 'Notice Approved' :
      'Notice Denied'
    }`;

    const defaultDescriptionText = {
      submit: 'Thank you for submitting your inactivity notice for **{workspace}**. It will be reviewed by staff.',
      approval: 'Your inactivity notice for **{workspace}** has been **approved**.',
      denial: 'Your inactivity notice for **{workspace}** has been **denied**.'
    };

    // Build the embed
    const embed = {
      title: customTitle[noticeType] ? replaceVariables(customTitle[noticeType]) : defaultTitle,
      description: customDescription[noticeType] ? replaceVariables(customDescription[noticeType]) : replaceVariables(defaultDescriptionText[noticeType]),
      color: customColor[noticeType] ? parseInt(customColor[noticeType].replace('#', ''), 16) : defaultColor[noticeType],
      timestamp: new Date().toISOString(),
      footer: {
        text: customFooter[noticeType] ? replaceVariables(customFooter[noticeType]) : `${workspace.groupName || 'Workspace'} • Notice System`
      },
      fields: [
        {
          name: 'Notice Details',
          value: `**Reason:** ${noticeDetails.reason}\n**Start Date:** ${noticeDetails.startTime.toLocaleDateString()}${noticeDetails.endTime ? `\n**End Date:** ${noticeDetails.endTime.toLocaleDateString()}` : ''}`,
          inline: false
        }
      ]
    };

    // Add review info for approval/denial
    if (noticeType !== 'submit' && (noticeDetails.reviewComment || reviewedByName !== 'System')) {
      embed.fields.push({
        name: 'Review Information',
        value: `**Reviewed By:** ${reviewedByName}${noticeDetails.reviewComment ? `\n**Comment:** ${noticeDetails.reviewComment}` : ''}`,
        inline: false
      });
    }

    // Send DM using Discord API
    const discordBotToken = decryptToken(discordIntegration.botToken);

    // Create DM channel and send message
    try {
      const dmChannelResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${discordBotToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient_id: lookupResult.user.primaryDiscordID
        })
      });

      if (!dmChannelResponse.ok) {
        throw new Error('Failed to create DM channel');
      }

      const dmChannel = await dmChannelResponse.json();

      const messageResponse = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${discordBotToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          embeds: [embed]
        })
      });

      if (!messageResponse.ok) {
        throw new Error('Failed to send DM');
      }

      console.log(`[NoticeNotification] Sent ${noticeType} notification to Discord user ${lookupResult.user.primaryDiscordID}`);

    } catch (dmError: any) {
      throw new Error(`Failed to send Discord DM: ${dmError.message}`);
    }
  } catch (error: any) {
    console.error(`[NoticeNotification] Failed to send ${noticeType} notification:`, error);
  }
}
