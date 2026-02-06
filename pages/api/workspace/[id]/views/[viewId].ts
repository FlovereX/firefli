import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withSessionRoute } from "@/lib/withSession";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const workspaceId = Number(req.query.id as string);
  const viewId = String(req.query.viewId as string);
  if (!workspaceId) return res.status(400).json({ success: false, error: "Missing workspace ID" });
  if (!viewId) return res.status(400).json({ success: false, error: "Missing view ID" });

  try {
    if (req.method === "DELETE") {
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
      const existingView = await prisma.savedView.findFirst({
        where: { id: viewId, workspaceGroupId: workspaceId },
      });
      if (!existingView) return res.status(404).json({ success: false, error: "View not found" });

      if (existingView.isLocal) {
        // local view deletion ONLY
        if (existingView.createdBy !== userId) {
          return res.status(403).json({ success: false, error: "You can only delete your own local views" });
        }
      } else {
        const hasDeletePermission = isAdmin || user.roles[0].permissions.includes("delete_views");
        if (!hasDeletePermission) return res.status(401).json({ success: false, error: "Unauthorized" });
      }
      const deleted = await prisma.savedView.deleteMany({ where: { id: viewId, workspaceGroupId: workspaceId } });
      if (deleted.count === 0) return res.status(404).json({ success: false, error: "View not found" });
      return res.status(200).json({ success: true });
    }

    if (req.method === "PATCH") {
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

      const existingView = await prisma.savedView.findFirst({
        where: { id: viewId, workspaceGroupId: workspaceId },
      });
      if (!existingView) {
        return res.status(404).json({ success: false, error: "View not found" });
      }

      if (existingView.isLocal) {
        if (existingView.createdBy !== userId) {
          return res.status(403).json({ success: false, error: "You can only edit your own local views" });
        }
      } else {
        const hasEditPermission = isAdmin || user.roles[0].permissions.includes("edit_views");
        if (!hasEditPermission) return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const { filters, columnVisibility } = req.body;
      if (!filters && !columnVisibility) {
        return res.status(400).json({ success: false, error: "Missing filters or columnVisibility" });
      }

      const updated = await prisma.savedView.update({
        where: { id: viewId },
        data: {
          filters: filters || existingView.filters,
          columnVisibility: columnVisibility || existingView.columnVisibility,
        },
      });

      return res.status(200).json({ success: true, view: { ...updated, createdBy: updated.createdBy ? updated.createdBy.toString() : null } });
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (e) {
    console.error("View API error:", e);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export default withSessionRoute(handler);
