import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { withPermissionCheck } from "@/utils/permissionsManager";
import { logAudit } from "@/utils/logs";
import { getWorkspaceRobloxApiKey } from "@/utils/openCloud";

type Data = {
  success: boolean;
  error?: string;
  newRole?: string;
};

export default withPermissionCheck(handler, "admin");

export async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST")
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });

  const workspaceGroupId = parseInt(req.query.id as string);
  const userId = BigInt(req.query.userid as string);
  const userIdNum = Number(userId);

  const user = await prisma.user.findUnique({
    where: { userid: userId },
    include: {
      roles: {
        where: { workspaceGroupId },
      },
    },
  });

  if (!user?.roles.length) {
    return res
      .status(404)
      .json({
        success: false,
        error: "User not found or has no role in this workspace",
      });
  }

  const currentRole = user.roles[0];
  let robloxRoleId: number | null = null;
  try {
    const apiKey = await getWorkspaceRobloxApiKey(workspaceGroupId);
    if (apiKey) {
      const ocRes = await fetch(
        `https://apis.roblox.com/cloud/v2/groups/${workspaceGroupId}/memberships?filter=user == 'users/${userIdNum}'&maxPageSize=1`,
        { headers: { "x-api-key": apiKey } },
      );
      if (ocRes.ok) {
        const data = await ocRes.json();
        if (data.groupMemberships?.[0]?.role) {
          const rolePath = data.groupMemberships[0].role;
          const match = rolePath.match(/roles\/(\d+)/);
          if (match) robloxRoleId = parseInt(match[1]);
        }
      }
    }
  } catch (e) {
    console.error(
      `[Resync] Failed to fetch Roblox group role for user ${userIdNum}:`,
      e,
    );
  }

  if (robloxRoleId === null) {
    return res
      .status(400)
      .json({
        success: false,
        error: "Could not determine user's current Roblox group role",
      });
  }

  const workspaceRoles = await prisma.role.findMany({
    where: { workspaceGroupId },
  });

  const correctRole = workspaceRoles.find(
    (r) => !r.isOwnerRole && r.groupRoles?.includes(robloxRoleId!),
  );

  if (!correctRole) {
    return res
      .status(400)
      .json({
        success: false,
        error: "No workspace role is mapped to the user's current Roblox rank",
      });
  }

  if (currentRole.id !== correctRole.id) {
    await prisma.user.update({
      where: { userid: userId },
      data: {
        roles: {
          disconnect: { id: currentRole.id },
          connect: { id: correctRole.id },
        },
      },
    });

    await prisma.roleMember.deleteMany({
      where: { roleId: currentRole.id, userId },
    });
  }

  await prisma.roleMember.upsert({
    where: {
      roleId_userId: {
        roleId: correctRole.id,
        userId,
      },
    },
    update: { manuallyAdded: false },
    create: {
      roleId: correctRole.id,
      userId,
      manuallyAdded: false,
    },
  });

  await prisma.rank.upsert({
    where: {
      userId_workspaceGroupId: {
        userId,
        workspaceGroupId,
      },
    },
    update: { rankId: BigInt(robloxRoleId) },
    create: {
      userId,
      workspaceGroupId,
      rankId: BigInt(robloxRoleId),
    },
  });

  try {
    await logAudit(
      workspaceGroupId,
      (req as any).session?.userid || null,
      "settings.users.resync",
      `user:${req.query.userid}`,
      {
        userId: userIdNum,
        previousRole: currentRole.id,
        newRole: correctRole.id,
        robloxRoleId,
      },
    );
  } catch (e) {}

  res.status(200).json({ success: true, newRole: correctRole.id });
}