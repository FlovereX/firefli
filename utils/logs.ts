import prisma from './database';
import DiscordAPI, { decryptToken, formatAuditEvent } from './discord';
import { getRemoteAvatarUrl } from './avatarManager';
import { getUsername } from './userinfoEngine';

export type AuditDetails = Record<string, any>;

async function sendToDiscord(workspaceGroupId: number, userId: number | null, action: string, details?: AuditDetails) {
  try {
    const integration = await prisma.discordIntegration.findUnique({
      where: { workspaceGroupId },
    });

    if (!integration || !integration.isActive) return;

    // Check if this event type is enabled
    const enabledEvents = integration.enabledEvents as string[];
    if (!enabledEvents.includes(action)) return;

    // Get user info for the embed
    let userName = 'System';
    let avatarUrl: string | undefined;
    if (userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { userid: BigInt(userId) },
          select: { username: true },
        });
        if (user?.username) {
          userName = user.username;
        } else {
          try {
            userName = await getUsername(userId) || 'Unknown';
          } catch (e) {
            userName = 'Unknown';
          }
        }
        try {
          avatarUrl = await getRemoteAvatarUrl(userId);
        } catch (e) {
          // Ignore thumbnail fetch errors
        }
      } catch (e) {
        // Ignore user lookup errors
      }
    }

    // Resolve target user's username for userbook actions
    if (action === 'userbook.create' && details?.userId) {
      try {
        const targetUser = await prisma.user.findUnique({
          where: { userid: BigInt(details.userId) },
          select: { username: true },
        });
        if (targetUser?.username) {
          details.targetUsername = targetUser.username;
        } else {
          const targetName = await getUsername(Number(details.userId));
          if (targetName) details.targetUsername = targetName;
        }
      } catch (e) {
        // Fall back to userId
      }
    }

    const botToken = decryptToken(integration.botToken);
    const discord = new DiscordAPI(botToken);

    const message = formatAuditEvent(action, userName, details, avatarUrl, {
      title: integration.embedTitle,
      color: integration.embedColor,
      footer: integration.embedFooter,
      thumbnail: integration.embedThumbnail,
    });

    await discord.sendMessage(integration.channelId, message);

    // Update last message timestamp
    await prisma.discordIntegration.update({
      where: { workspaceGroupId },
      data: {
        lastMessageAt: new Date(),
        errorCount: 0,
        lastError: null,
      },
    });
  } catch (error: any) {
    console.error('[Discord] Failed to send audit event:', error);
    try {
      await prisma.discordIntegration.update({
        where: { workspaceGroupId },
        data: {
          errorCount: { increment: 1 },
          lastError: error.message || 'Unknown error',
        },
      });
    } catch (e) {
      // Ignore update errors
    }
  }
}

export async function logAudit(workspaceGroupId: number, userId: number | null, action: string, entity?: string, details?: AuditDetails) {
  try {
    const p: any = prisma as any;
    if (p && p.auditLog) {
      await p.auditLog.create({
        data: {
          workspaceGroupId,
          userId: userId ? BigInt(userId) : undefined,
          action,
          entity: entity || null,
          details: details || null,
        },
      });

      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      await p.auditLog.deleteMany({
        where: {
          workspaceGroupId,
          createdAt: { lt: cutoff },
        },
      });

      // Send to Discord after logging
      sendToDiscord(workspaceGroupId, userId, action, details).catch(() => {});
      return;
    }

    const detailsJson = details ? JSON.stringify(details) : null;
    await prisma.$executeRaw`
      INSERT INTO "AuditLog" ("workspaceGroupId","userId","action","entity","details","createdAt")
      VALUES (${workspaceGroupId}, ${userId ? BigInt(userId) : null}, ${action}, ${entity || null}, ${detailsJson}::jsonb, NOW())`;

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await prisma.$executeRaw`
      DELETE FROM "AuditLog" WHERE "workspaceGroupId" = ${workspaceGroupId} AND "createdAt" < ${cutoff}`;

    // Send to Discord after logging
    sendToDiscord(workspaceGroupId, userId, action, details).catch(() => {});
  } catch (e) {
    console.error('[Audit] Failed to log audit', e);
  }
}

export async function queryAudit(workspaceGroupId: number, opts: { userId?: number; action?: string; search?: string; skip?: number; take?: number } = {}) {
  const where: any = { workspaceGroupId };
  if (opts.userId) where.userId = BigInt(opts.userId);
  if (opts.action) where.action = opts.action;
  if (opts.search) {
    where.OR = [
      { action: { contains: opts.search, mode: 'insensitive' } },
      { entity: { contains: opts.search, mode: 'insensitive' } },
      { details: { path: [], array_contains: [] } },
    ];
  }

  try {
    const p: any = prisma as any;
    if (p && p.auditLog) {
      const [rows, total] = await Promise.all([
        p.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: opts.skip || 0, take: opts.take || 50 }),
        p.auditLog.count({ where }),
      ]);
      const sanitize = (v: any): any => {
        if (v === null || v === undefined) return v;
        if (typeof v === 'bigint') return v.toString();
        if (Array.isArray(v)) return v.map(sanitize);
        if (v instanceof Date) return v.toISOString();
        if (typeof v === 'object') {
          const out: any = {};
          for (const k of Object.keys(v)) out[k] = sanitize(v[k]);
          return out;
        }
        return v;
      };

      return { rows: rows.map(sanitize), total };
    }

    const clauses: string[] = ['"workspaceGroupId" = $1'];
    const params: any[] = [workspaceGroupId];
    let idx = 2;
    if (opts.userId) {
      clauses.push(`"userId" = $${idx++}`);
      params.push(BigInt(opts.userId));
    }
    if (opts.action) {
      clauses.push(`"action" = $${idx++}`);
      params.push(opts.action);
    }
    if (opts.search) {
      clauses.push(`(LOWER("action") LIKE LOWER($${idx}) OR LOWER(COALESCE("entity", '')) LIKE LOWER($${idx}) OR LOWER(COALESCE(CAST("details" AS TEXT), '')) LIKE LOWER($${idx}))`);
      params.push(`%${opts.search}%`);
      idx++;
    }

    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const take = Math.max(1, Math.min(Number(opts.take) || 50, 200));
    const skip = Math.max(0, Number(opts.skip) || 0);

    params.push(take);
    const limitIdx = idx++;
    params.push(skip);
    const offsetIdx = idx++;

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "AuditLog" ${whereSql} ORDER BY "createdAt" DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      ...params
    );

    const countRes: any = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS cnt FROM "AuditLog" ${whereSql}`,
      ...params.slice(0, -2)
    );
    const total = Array.isArray(countRes) && countRes[0] ? Number(countRes[0].cnt || countRes[0].count || 0) : 0;

    return { rows, total };
  } catch (e) {
    console.error('[Audit] Error querying audits', e);
    throw e;
  }
}

export default { logAudit, queryAudit };
