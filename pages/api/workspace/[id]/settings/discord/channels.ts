import type { NextApiRequest, NextApiResponse } from 'next';
import { withPermissionCheck } from '@/utils/permissionsManager';
import DiscordAPI from '@/utils/discord';

type Data = {
  success: boolean;
  error?: string;
  channels?: Array<{
    id: string;
    name: string;
    position: number;
  }>;
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

  const { botToken, guildId } = req.body;
  if (!botToken || typeof botToken !== 'string') {
    return res.status(400).json({ success: false, error: 'Bot token is required' });
  }
  if (!guildId || typeof guildId !== 'string') {
    return res.status(400).json({ success: false, error: 'Guild ID is required' });
  }

  try {
    const discord = new DiscordAPI(botToken);

    // Get channels for the guild
    const channels = await discord.getGuildChannels(guildId);

    if (channels.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No text channels found in this server or bot lacks permissions.'
      });
    }

    return res.status(200).json({
      success: true,
      channels: channels.map(channel => ({
        id: channel.id,
        name: channel.name,
        position: channel.position,
      }))
    });
  } catch (error: any) {
    console.error('[Discord] Channels error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch channels'
    });
  }
}
