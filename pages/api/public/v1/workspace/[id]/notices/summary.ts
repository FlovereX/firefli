import type { NextApiRequest, NextApiResponse } from "next"
import prisma from "@/utils/database"
import { validateApiKey } from "@/utils/api-auth"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed" })

  const apiKey = req.headers.authorization?.replace("Bearer ", "")
  if (!apiKey) return res.status(401).json({ success: false, error: "Missing API key" })

  const workspaceId = Number.parseInt(req.query.id as string)
  if (!workspaceId) return res.status(400).json({ success: false, error: "Missing workspace ID" })

  try {
    // Validate API key
    const key = await validateApiKey(apiKey, workspaceId.toString())
    if (!key) {
      return res.status(401).json({ success: false, error: "Invalid API key" })
    }

    const now = new Date()

    const [
      totalNotices,
      pendingNotices,
      approvedNotices,
      rejectedNotices,
      activeNotices,
    ] = await Promise.all([
      // Total notices
      prisma.inactivityNotice.count({
        where: {
          workspaceGroupId: workspaceId,
        },
      }),
      // Pending (not reviewed)
      prisma.inactivityNotice.count({
        where: {
          workspaceGroupId: workspaceId,
          reviewed: false,
        },
      }),
      // Approved
      prisma.inactivityNotice.count({
        where: {
          workspaceGroupId: workspaceId,
          approved: true,
          reviewed: true,
        },
      }),
      // Rejected
      prisma.inactivityNotice.count({
        where: {
          workspaceGroupId: workspaceId,
          approved: false,
          reviewed: true,
        },
      }),
      // Currently active (not ended and not revoked)
      prisma.inactivityNotice.count({
        where: {
          workspaceGroupId: workspaceId,
          OR: [
            { endTime: { gte: now } },
            { endTime: null },
          ],
          revoked: false,
          approved: true,
        },
      }),
    ])

    return res.status(200).json({
      success: true,
      summary: {
        total: totalNotices,
        pending: pendingNotices,
        approved: approvedNotices,
        rejected: rejectedNotices,
        active: activeNotices,
      },
    })
  } catch (error) {
    console.error("Error in public notices summary API:", error)
    return res.status(500).json({ success: false, error: "Internal server error" })
  }
}
