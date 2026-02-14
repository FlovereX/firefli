import type { NextApiRequest, NextApiResponse } from 'next';
import { withPermissionCheck } from '@/utils/permissionsManager';
import prisma from '@/utils/database';

type Data = {
  success: boolean;
  error?: string;
  discordId?: string;
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

  const { robloxUserId } = req.body;
  if (!robloxUserId) {
    return res.status(400).json({ success: false, error: 'Missing robloxUserId' });
  }

  try {
    const integration = await prisma.bloxlinkIntegration.findUnique({
      where: { workspaceGroupId: workspaceId },
    });

    if (!integration || !integration.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Bloxlink integration not configured',
      });
    }

    const { BloxlinkAPI, decryptApiKey } = await import('@/utils/bloxlink');
    const decryptedApiKey = decryptApiKey(integration.apiKey);
    const bloxlink = new BloxlinkAPI(decryptedApiKey, integration.discordServerId);

    const result = await bloxlink.lookupUserByRobloxId(Number(robloxUserId));

    if (!result.success || !result.user?.primaryDiscordID) {
      return res.status(200).json({
        success: false,
        error: 'No Discord account linked via Bloxlink for this user',
      });
    }

    return res.status(200).json({
      success: true,
      discordId: result.user.primaryDiscordID,
    });
  } catch (error: any) {
    console.error('[Bloxlink Lookup] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to lookup user',
    });
  }
}
