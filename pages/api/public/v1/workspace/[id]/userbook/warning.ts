import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { validateApiKey } from "@/utils/api-auth";
import { withPublicApiRateLimit } from "@/utils/prtl";
import { logAudit } from "@/utils/logs";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  const apiKey = req.headers.authorization?.replace("Bearer ", "");
  if (!apiKey)
    return res.status(401).json({ success: false, error: "Missing API key" });

  const workspaceId = Number.parseInt(req.query.id as string);
  if (!workspaceId)
    return res
      .status(400)
      .json({ success: false, error: "Missing workspace ID" });

  try {
    const key = await validateApiKey(apiKey, workspaceId);
    if (!key) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid or expired API key" });
    }

    const { userId, reason } = req.body;

    if (!userId || !reason) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: userId, reason",
      });
    }

    const numericUserId = Number.parseInt(String(userId));
    if (isNaN(numericUserId)) {
      return res
        .status(400)
        .json({ success: false, error: "userId must be a valid number" });
    }

    const adminId = BigInt(key.createdById);

    if (BigInt(numericUserId) === adminId) {
      return res.status(400).json({
        success: false,
        error: "You cannot perform actions on yourself.",
      });
    }

    const userbook = await prisma.userBook.create({
      data: {
        userId: BigInt(numericUserId),
        type: "warning",
        workspaceGroupId: workspaceId,
        reason,
        adminId,
      },
      include: { admin: true },
    });

    try {
      await logAudit(
        workspaceId,
        Number(adminId),
        "userbook.create",
        `userbook:${userbook.id}`,
        {
          type: "warning",
          userId: numericUserId,
          adminId: Number(adminId),
          reason,
          source: "public_api",
        },
      );
    } catch {}

    return res.status(201).json({
      success: true,
      entry: JSON.parse(
        JSON.stringify(userbook, (_, v) =>
          typeof v === "bigint" ? v.toString() : v,
        ),
      ),
    });
  } catch (error) {
    console.error("[Public API] Error creating warning entry:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export default withPublicApiRateLimit(handler);