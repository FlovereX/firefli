import type { NextApiRequest, NextApiResponse } from 'next';
import { withPermissionCheck } from '@/utils/permissionsManager';
import DiscordAPI from '@/utils/discord';

type Data = {
  success: boolean;
  error?: string;
  guilds?: Array<{
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
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

  const { botToken } = req.body;
  if (!botToken || typeof botToken !== 'string') {
    return res.status(400).json({ success: false, error: 'Bot token is required' });
  }

  try {
    const discord = new DiscordAPI(botToken);

    // Validate the bot token
    const isValid = await discord.validateToken();
    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Invalid bot token' });
    }

    // Get guilds where bot has admin permissions
    const guilds = await discord.getGuilds();

    if (guilds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bot is not in any guilds with admin permissions. Please invite the bot to a server and grant it admin permissions.'
      });
    }

    return res.status(200).json({
      success: true,
      guilds: guilds.map(guild => ({
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        owner: guild.owner,
      }))
    });
  } catch (error: any) {
    console.error('[Discord] Setup error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to validate bot token'
    });
  }
}
