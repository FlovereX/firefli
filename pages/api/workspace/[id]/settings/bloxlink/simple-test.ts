import type { NextApiRequest, NextApiResponse } from 'next';
import { withPermissionCheck } from '@/utils/permissionsManager';
import prisma from '@/utils/database';

type Data = {
  success: boolean;
  error?: string;
  message?: string;
  data?: any;
};

export default withPermissionCheck(handler, 'admin');

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const workspaceId = parseInt(req.query.id as string);
  if (!workspaceId) {
    return res.status(400).json({ success: false, error: 'Missing workspace id' });
  }

  try {
    // Get Bloxlink integration
    const integration = await prisma.bloxlinkIntegration.findUnique({
      where: { workspaceGroupId: workspaceId },
    });

    if (!integration || !integration.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Bloxlink integration not found or inactive'
      });
    }

    // Get workspace info
    const workspaceInfo = await prisma.workspace.findUnique({
      where: { groupId: workspaceId },
      select: { groupName: true }
    });

    if (!workspaceInfo) {
      return res.status(404).json({
        success: false,
        error: 'Workspace not found'
      });
    }

    // Get current user info for test
    if (!req.session?.userid) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // Import Bloxlink utilities
    const { BloxlinkAPI, decryptApiKey, formatNotificationMessage } = await import('@/utils/bloxlink');

    const decryptedApiKey = decryptApiKey(integration.apiKey);
    const bloxlink = new BloxlinkAPI(decryptedApiKey, integration.discordServerId);

    // Try to lookup the current user
    const lookupResult = await bloxlink.lookupUserByRobloxId(Number(req.session.userid));

    if (!lookupResult.success || !lookupResult.user?.primaryDiscordID) {
      return res.status(400).json({
        success: false,
        error: 'Your Roblox account is not linked to Discord via Bloxlink in this server'
      });
    }

    // Create test notification embed
    const testEmbed = {
      title: '📈 Test Notification',
      description: `This is a test notification from **${workspaceInfo.groupName || 'Test Workspace'}**`,
      color: 0x00ff00, // Green
      fields: [
        {
          name: '📝 Reason',
          value: 'This is a test notification from Firefli',
          inline: false
        },
        {
          name: '👤 Issued by',
          value: 'System',
          inline: true
        },
        {
          name: '🏆 New Rank',
          value: 'Test Role',
          inline: true
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: workspaceInfo.groupName || 'Firefli'
      }
    };

    // Get Discord integration for sending DM
    const discordIntegration = await prisma.discordIntegration.findUnique({
      where: { workspaceGroupId: workspaceId },
    });

    if (!discordIntegration || !discordIntegration.isActive) {
      return res.status(400).json({
        success: false,
        error: 'Discord integration required for sending DMs'
      });
    }

    // Import Discord utilities
    const { decryptToken } = await import('@/utils/discord');
    const discordBotToken = decryptToken(discordIntegration.botToken);

    // Send test DM using Discord API
    try {
      // Create DM channel
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
        throw new Error('Failed to create DM channel - user may have DMs disabled');
      }

      const dmChannel = await dmChannelResponse.json();

      // Send message
      const messageResponse = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${discordBotToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          embeds: [testEmbed]
        })
      });

      if (!messageResponse.ok) {
        const errorData = await messageResponse.json().catch(() => ({}));
        throw new Error(`Failed to send DM: ${errorData.message || messageResponse.statusText}`);
      }

      // Update last used timestamp on success
      await prisma.bloxlinkIntegration.update({
        where: { workspaceGroupId: workspaceId },
        data: {
          lastUsed: new Date(),
          errorCount: 0,
          lastError: null,
        },
      });

      return res.status(200).json({
        success: true,
        message: `Test notification sent successfully to Discord user ${lookupResult.user.primaryDiscordID}`
      });

    } catch (dmError: any) {
      throw new Error(`Discord DM failed: ${dmError.message}`);
    }

  } catch (error: any) {
    console.error('[Simple Test] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error'
    });
  }
}
