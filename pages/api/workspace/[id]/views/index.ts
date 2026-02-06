import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { v4 as uuidv4 } from "uuid";
import { withSessionRoute } from "@/lib/withSession";

async function hasManageViewsPermission(req: NextApiRequest, workspaceId: number) {
  if (!req.session?.userid) return false;
  const user = await prisma.user.findFirst({
    where: { userid: BigInt(req.session.userid) },
    include: {
      roles: {
        where: { workspaceGroupId: workspaceId },
      },
      workspaceMemberships: {
        where: { workspaceGroupId: workspaceId },
      },
    },
  });
  if (!user || !user.roles.length) return false;
  const role = user.roles[0];
  const membership = user.workspaceMemberships[0];
  const isAdmin = membership?.isAdmin || false;
  return isAdmin || (role.permissions || []).includes("create_views") || (role.permissions || []).includes("edit_views") || (role.permissions || []).includes("delete_views");
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const workspaceId = Number(req.query.id as string);
  if (!workspaceId) return res.status(400).json({ success: false, error: "Missing workspace ID" });

  try {
    if (req.method === "GET") {
      if (!req.session?.userid) return res.status(401).json({ success: false, error: "Unauthorized" });
      const userId = BigInt(req.session.userid);
      const user = await prisma.user.findFirst({
        where: { userid: userId },
        include: {
          roles: { where: { workspaceGroupId: workspaceId } },
          workspaceMemberships: { where: { workspaceGroupId: workspaceId } },
        },
      });
      if (!user || !user.roles.length) return res.status(401).json({ success: false, error: "Unauthorized" });
      const membership = user.workspaceMemberships[0];
      const isAdmin = membership?.isAdmin || false;
      const hasUseViewsPermission = isAdmin || user.roles[0].permissions.includes("use_views");
      const localViews = await prisma.savedView.findMany({
        where: { workspaceGroupId: workspaceId, isLocal: true, createdBy: userId },
        orderBy: { createdAt: 'asc' },
      });
      const teamViews = hasUseViewsPermission
        ? await prisma.savedView.findMany({
            where: { workspaceGroupId: workspaceId, isLocal: false },
            orderBy: { createdAt: 'asc' },
          })
        : [];

      const serializeView = (v: any) => ({ ...v, createdBy: v.createdBy ? v.createdBy.toString() : null });
      return res.status(200).json({ success: true, views: teamViews.map(serializeView), localViews: localViews.map(serializeView) });
    }

    if (req.method === "POST") {
      if (!req.session?.userid) return res.status(401).json({ success: false, error: "Unauthorized" });
      const userId = BigInt(req.session.userid);
      const user = await prisma.user.findFirst({
        where: { userid: userId },
        include: {
          roles: { where: { workspaceGroupId: workspaceId } },
          workspaceMemberships: { where: { workspaceGroupId: workspaceId } },
        },
      });
      if (!user || !user.roles.length) return res.status(401).json({ success: false, error: "Unauthorized" });
      const membership = user.workspaceMemberships[0];
      const isAdmin = membership?.isAdmin || false;

      const { name, color, icon, filters, columnVisibility, isLocal } = req.body;
      if (!name) return res.status(400).json({ success: false, error: "Missing name" });
      if (isLocal) {
        // local view creation ONLY
      } else {
        const hasCreatePermission = isAdmin || user.roles[0].permissions.includes("create_views");
        if (!hasCreatePermission) return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const newView = await prisma.savedView.create({
        data: {
          id: uuidv4(),
          workspaceGroupId: workspaceId,
          name,
          color: color || null,
          icon: icon || null,
          filters: filters || [],
          columnVisibility: columnVisibility || {},
          isLocal: isLocal || false,
          createdBy: isLocal ? userId : null,
        },
      });

      return res.status(201).json({ success: true, view: { ...newView, createdBy: newView.createdBy ? newView.createdBy.toString() : null } });
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (e) {
    console.error("Views API error:", e);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export default withSessionRoute(handler);
