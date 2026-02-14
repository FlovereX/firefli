import type { NextApiRequest, NextApiResponse } from 'next';
import { withPermissionCheck } from '@/utils/permissionsManager';
import prisma from '@/utils/database';
import DiscordAPI, { decryptToken } from '@/utils/discord';

type Data = {
  success: boolean;
  error?: string;
  channels?: Array<{
    id: string;
    name: string;
    type: number;
    position: number;
  }>;
  roles?: Array<{
    id: string;
    name: string;
    color: number;
    position: number;
  }>;
};

export default withPermissionCheck(handler, 'admin');

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const workspaceId = parseInt(req.query.id as string);
  if (!workspaceId) {
    return res.status(400).json({ success: false, error: 'Missing workspace id' });
  }

  try {
    const integration = await prisma.discordIntegration.findUnique({
      where: { workspaceGroupId: workspaceId },
    });

    if (!integration) {
      return res.status(404).json({ success: false, error: 'No Discord integration found' });
    }

    const botToken = decryptToken(integration.botToken);
    const discord = new DiscordAPI(botToken);

    const [channels, roles] = await Promise.all([
      discord.getGuildChannels(integration.guildId),
      discord.getGuildRoles(integration.guildId),
    ]);

    return res.status(200).json({
      success: true,
      channels,
      roles,
    });
  } catch (error: any) {
    console.error('[Discord] Integration channels error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch Discord channels'
    });
  }
}
