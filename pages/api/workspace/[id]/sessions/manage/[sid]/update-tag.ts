import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withSessionRoute } from "@/lib/withSession";

export default withSessionRoute(
  async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== "POST" && req.method !== "DELETE") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { id, sid } = req.query;
    const { sessionId, sessionTagId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "Missing session ID" });
    }

    try {
      const userId = (req as any).session?.userid;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const user = await prisma.user.findFirst({
        where: { userid: BigInt(userId) },
        include: {
          roles: { where: { workspaceGroupId: parseInt(id as string) } },
          workspaceMemberships: {
            where: { workspaceGroupId: parseInt(id as string) },
          },
        },
      });

      const membership = user?.workspaceMemberships?.[0];
      const isAdmin = membership?.isAdmin || false;
      const userRole = user?.roles?.[0];

      // Check if user has assign_tag permission for this session type
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          sessionType: true,
          sessionTag: true,
        },
      });

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const sessionType = session.type || "other";
      const hasAssignTagPermission =
        isAdmin ||
        userRole?.permissions.includes(`sessions_${sessionType}_assign_tag`) ||
        userRole?.permissions.includes("admin");

      if (!hasAssignTagPermission) {
        return res.status(403).json({
          error: "You don't have permission to assign tags to this session type",
        });
      }

      if (sessionTagId) {
        const tag = await prisma.sessionTag.findFirst({
          where: {
            id: sessionTagId,
            workspaceGroupId: parseInt(id as string),
          },
        });

        if (!tag) {
          return res.status(404).json({ error: "Tag not found" });
        }

        const sessionCategory = session.type || "other";
        if (
          tag.allowedTypes.length > 0 &&
          !tag.allowedTypes.includes(sessionCategory)
        ) {
          return res.status(400).json({
            error: "This tag is not available for this session type",
          });
        }
      }

      const oldTagName = session.sessionTag?.name || null;
      const oldTagId = session.sessionTagId;
      const updatedSession = await prisma.session.update({
        where: { id: sessionId },
        data: {
          sessionTagId: sessionTagId || null,
        },
        include: {
          sessionType: true,
          sessionTag: true,
          owner: true,
          users: {
            include: {
              user: true,
            },
          },
        },
      });

      const action = sessionTagId ? "tag_assigned" : "tag_removed";
      const newTagName = updatedSession.sessionTag?.name || null;
      await prisma.sessionLog.create({
        data: {
          sessionId: session.id,
          actorId: BigInt(userId),
          action: action,
          metadata: {
            oldTag: oldTagName ? { id: oldTagId, name: oldTagName } : null,
            newTag: newTagName
              ? { id: sessionTagId, name: newTagName }
              : null,
            sessionType: session.sessionType.name,
          },
        },
      });

      try {
        const { logAudit } = await import("@/utils/logs");
        const auditAction = sessionTagId
          ? "session.tag.assign"
          : "session.tag.remove";
        await logAudit(
          Number(id),
          Number(userId),
          auditAction,
          `session:${session.id}`,
          {
            sessionId: session.id,
            oldTag: oldTagName,
            newTag: newTagName,
          }
        );
      } catch (e) {
        console.error("Failed to log audit:", e);
      }

      return res.status(200).json({
        success: true,
        session: JSON.parse(
          JSON.stringify(updatedSession, (key, value) =>
            typeof value === "bigint" ? value.toString() : value
          )
        ),
      });
    } catch (error) {
      console.error("Error updating session tag:", error);
      return res
        .status(500)
        .json({ error: "Failed to update session tag" });
    }
  }
);
