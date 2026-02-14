import type { NextApiRequest, NextApiResponse } from 'next';
import { withPermissionCheck } from '@/utils/permissionsManager';
import prisma from '@/utils/database';

type Data = {
  success: boolean;
  error?: string;
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
    // Clear the last error from the Bloxlink integration
    await prisma.bloxlinkIntegration.update({
      where: { workspaceGroupId: workspaceId },
      data: {
        lastError: null,
        errorCount: 0,
      },
    });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[Clear Error] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to clear error'
    });
  }
}
