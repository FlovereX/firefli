import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/utils/database';
import { withPermissionCheck } from '@/utils/permissionsManager';
import { getThumbnail } from '@/utils/userinfoEngine';

type Data = {
	success: boolean;
	error?: string;
	users?: any[];
	total?: number;
	page?: number;
	pageSize?: number;
	totalPages?: number;
	roleCounts?: Record<string, number>;
};

export default withPermissionCheck(handler, 'admin');

export async function handler(
	req: NextApiRequest,
	res: NextApiResponse<Data>
) {
	if (req.method !== 'GET') {
		return res.status(405).json({ success: false, error: 'Method not allowed' });
	}

	const workspaceGroupId = Number.parseInt(req.query.id as string);
	const roleId = req.query.roleId as string | undefined;
	const page = Math.max(1, parseInt(req.query.page as string) || 1);
	const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
	const search = (req.query.search as string || '').trim().toLowerCase();

	try {
		if (!roleId) {
			const roles = await prisma.role.findMany({
				where: { workspaceGroupId },
				select: { id: true, name: true },
			});

			const roleCounts: Record<string, number> = {};
			for (const role of roles) {
				const count = await prisma.user.count({
					where: {
						roles: { some: { id: role.id } },
						...(search ? {
							OR: [
								{ username: { contains: search, mode: 'insensitive' } },
								{ displayName: { contains: search, mode: 'insensitive' } },
							],
						} : {}),
					},
				});
				roleCounts[role.id] = count;
			}

			return res.status(200).json({ success: true, roleCounts });
		}

		const whereClause: any = {
			roles: { some: { id: roleId } },
		};

		if (search) {
			whereClause.OR = [
				{ username: { contains: search, mode: 'insensitive' } },
				{ displayName: { contains: search, mode: 'insensitive' } },
			];
		}

		const [total, users] = await Promise.all([
			prisma.user.count({ where: whereClause }),
			prisma.user.findMany({
				where: whereClause,
				skip: (page - 1) * pageSize,
				take: pageSize,
				orderBy: { username: 'asc' },
				select: {
					userid: true,
					username: true,
					displayName: true,
					picture: true,
					registered: true,
					roles: {
						where: { workspaceGroupId },
						select: {
							id: true,
							name: true,
							isOwnerRole: true,
						},
					},
					workspaceMemberships: {
						where: { workspaceGroupId },
						select: {
							isAdmin: true,
							userId: true,
							lineManagerId: true,
							joinDate: true,
						},
					},
				},
			}),
		]);

		const usersWithInfo = users.map((user) => {
			const uid = Number(user.userid);
			const username = user.username || 'Unknown';
			const displayName = user.displayName || username;

			return {
				userid: uid,
				username,
				thumbnail: getThumbnail(user.userid),
				displayName,
				registered: user.registered,
				roles: user.roles,
				workspaceMemberships: user.workspaceMemberships?.map((m) => ({
					...m,
					userId: Number(m.userId),
					lineManagerId: m.lineManagerId ? Number(m.lineManagerId) : null,
					joinDate: m.joinDate ? m.joinDate.toISOString() : null,
				})),
			};
		});

		return res.status(200).json({
			success: true,
			users: usersWithInfo,
			total,
			page,
			pageSize,
			totalPages: Math.ceil(total / pageSize),
		});
	} catch (error) {
		console.error('Error fetching users:', error);
		return res.status(500).json({ success: false, error: 'Internal server error' });
	}
}
