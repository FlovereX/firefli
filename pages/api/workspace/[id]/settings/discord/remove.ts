import type { NextApiRequest, NextApiResponse } from 'next';
import { withPermissionCheck } from '@/utils/permissionsManager';
import prisma from '@/utils/database';
import { logAudit } from '@/utils/logs';

type Data = {
  success: boolean;
  error?: string;
};

export default withPermissionCheck(handler, 'admin');

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const workspaceId = parseInt(req.query.id as string);
  if (!workspaceId) {
    return res.status(400).json({ success: false, error: 'Missing workspace id' });
  }

  try {
    // Check if integration exists
    const integration = await prisma.discordIntegration.findUnique({
      where: {
        workspaceGroupId: workspaceId,
      },
    });

    if (!integration) {
      return res.status(404).json({
        success: false,
        error: 'Discord integration not found'
      });
    }

    // Delete the integration
    await prisma.discordIntegration.delete({
      where: {
        workspaceGroupId: workspaceId,
      },
    });

    // Log the removal action
    await logAudit(workspaceId, null, 'discord.integration.remove', 'discord', {
      guildId: integration.guildId,
      channelId: integration.channelId,
    });

    return res.status(200).json({
      success: true,
    });
  } catch (error: any) {
    console.error('[Discord] Remove error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to remove Discord integration'
    });
  }
}
