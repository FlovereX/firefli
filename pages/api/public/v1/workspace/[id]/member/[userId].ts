import type { NextApiRequest, NextApiResponse } from "next"
import prisma from "@/utils/database"
import { validateApiKey } from "@/utils/api-auth"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed" })

  const apiKey = req.headers.authorization?.replace("Bearer ", "")
  if (!apiKey) return res.status(401).json({ success: false, error: "Missing API key" })

  const workspaceId = Number.parseInt(req.query.id as string)
  const userId = req.query.userId as string

  if (!workspaceId) return res.status(400).json({ success: false, error: "Missing workspace ID" })
  if (!userId) return res.status(400).json({ success: false, error: "Missing user ID" })

  try {
    const key = await validateApiKey(apiKey, workspaceId.toString())
    if (!key) {
      return res.status(401).json({ success: false, error: "Invalid API key" })
    }

    const now = new Date()

    const [member, activeNotice] = await Promise.all([
      prisma.workspaceMember.findUnique({
        where: {
          workspaceGroupId_userId: {
            workspaceGroupId: workspaceId,
            userId: BigInt(userId),
          },
        },
        select: {
          joinDate: true,
          isAdmin: true,
          user: {
            select: {
              userid: true,
              username: true,
              picture: true,
              roles: {
                where: {
                  workspaceGroupId: workspaceId,
                },
                select: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
            },
          },
          departmentMembers: {
            select: {
              department: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
            },
          },
        },
      }),
      prisma.inactivityNotice.findFirst({
        where: {
          workspaceGroupId: workspaceId,
          userId: BigInt(userId),
          approved: true,
          revoked: false,
          startTime: { lte: now },
          endTime: { gte: now },
        },
        select: { id: true },
      }),
    ])

    if (!member) {
      return res.status(404).json({ success: false, error: "Member not found" })
    }

    return res.status(200).json({
      success: true,
      member: {
        userId: Number(member.user.userid),
        username: member.user.username,
        thumbnail: member.user.picture,
        role: member.user.roles[0] ?? null,
        departments: member.departmentMembers.map((dm) => dm.department),
        joinDate: member.joinDate,
        isAdmin: member.isAdmin ?? false,
        onLeave: !!activeNotice,
      },
    })
  } catch (error) {
    console.error("Error in public member API:", error)
    return res.status(500).json({ success: false, error: "Internal server error" })
  }
}
