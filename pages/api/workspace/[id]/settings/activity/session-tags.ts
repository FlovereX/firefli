import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withSessionRoute } from "@/lib/withSession";
import { logAudit } from "@/utils/logs";
import { getUsername } from "@/utils/userinfoEngine";

type SessionTag = {
  id: string;
  name: string;
  color: string;
  allowedTypes: string[];
  workspaceGroupId: number;
  createdAt: Date;
  updatedAt: Date;
};

type Data = {
  success: boolean;
  error?: string;
  tags?: SessionTag[];
  tag?: SessionTag;
};

export default withSessionRoute(handler);

async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  const workspaceId = parseInt(req.query.id as string);
  const userId = (req as any).session?.userid;

  if (!workspaceId || !userId) {
    return res
      .status(400)
      .json({ success: false, error: "Missing required parameters" });
  }

  const user = await prisma.user.findFirst({
    where: { userid: BigInt(userId) },
    include: {
      roles: {
        where: { workspaceGroupId: workspaceId },
      },
      workspaceMemberships: {
        where: { workspaceGroupId: workspaceId },
      },
    },
  });

  const membership = user?.workspaceMemberships?.[0];
  const isAdmin = membership?.isAdmin || false;
  const userRole = user?.roles?.[0];
  const hasPermission =
    isAdmin || (userRole?.permissions?.includes("admin") ?? false);

  if (req.method === "GET") {
    try {
      const tags = await prisma.sessionTag.findMany({
        where: { workspaceGroupId: workspaceId },
        orderBy: { name: "asc" },
      });

      return res.status(200).json({
        success: true,
        tags: JSON.parse(
          JSON.stringify(tags, (key, value) =>
            typeof value === "bigint" ? value.toString() : value
          )
        ),
      });
    } catch (error) {
      console.error("Failed to fetch session tags:", error);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  }

  if (!hasPermission) {
    return res
      .status(403)
      .json({ success: false, error: "Admin access required" });
  }

  if (req.method === "POST") {
    const { name, color, allowedTypes } = req.body;

    if (!name || !color) {
      return res
        .status(400)
        .json({ success: false, error: "Name and color are required" });
    }

    try {
      const tag = await prisma.sessionTag.create({
        data: {
          name: name.trim(),
          color: color.trim(),
          workspaceGroupId: workspaceId,
          allowedTypes: allowedTypes || [],
        },
      });

      const username = await getUsername(BigInt(userId));
      await logAudit(
        workspaceId,
        Number(userId),
        "SESSION_TAG_CREATED",
        "SessionTag",
        {
          tagId: tag.id,
          tagName: tag.name,
          username,
        }
      );

      return res.status(201).json({
        success: true,
        tag: JSON.parse(
          JSON.stringify(tag, (key, value) =>
            typeof value === "bigint" ? value.toString() : value
          )
        ),
      });
    } catch (error) {
      console.error("Failed to create session tag:", error);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  }

  if (req.method === "PATCH") {
    const { id, name, color, allowedTypes } = req.body;

    if (!id || (!name && !color && !allowedTypes)) {
      return res
        .status(400)
        .json({ success: false, error: "Tag ID and at least one field to update are required" });
    }

    try {
      const updateData: any = {};
      if (name) updateData.name = name.trim();
      if (color) updateData.color = color.trim();
      if (allowedTypes !== undefined) {
        updateData.allowedTypes = allowedTypes;
      }

      const tag = await prisma.sessionTag.update({
        where: { id },
        data: updateData,
      });

      const username = await getUsername(BigInt(userId));
      await logAudit(
        workspaceId,
        Number(userId),
        "SESSION_TAG_UPDATED",
        "SessionTag",
        {
          tagId: tag.id,
          tagName: tag.name,
          username,
        }
      );

      return res.status(200).json({
        success: true,
        tag: JSON.parse(
          JSON.stringify(tag, (key, value) =>
            typeof value === "bigint" ? value.toString() : value
          )
        ),
      });
    } catch (error) {
      console.error("Failed to update session tag:", error);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  }

  if (req.method === "DELETE") {
    const { id } = req.body;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, error: "Tag ID is required" });
    }

    try {
      await prisma.session.updateMany({
        where: { sessionTagId: id },
        data: { sessionTagId: null },
      });

      const tag = await prisma.sessionTag.delete({
        where: { id },
      });

      const username = await getUsername(BigInt(userId));
      await logAudit(
        workspaceId,
        Number(userId),
        "SESSION_TAG_DELETED",
        "SessionTag",
        {
          tagId: tag.id,
          tagName: tag.name,
          username,
        }
      );

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Failed to delete session tag:", error);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
