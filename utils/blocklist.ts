// shouldnt even  have to add this but children will be children
function getBlockedUserIds(): Set<string> {
  const blocklistEnv = process.env.ROBLOX_BLOCKLIST;
  
  if (!blocklistEnv || blocklistEnv.trim() === '') {
    return new Set();
  }

  const blockedIds = blocklistEnv
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);

  return new Set(blockedIds);
}

export function isUserBlocked(userId: string | number | bigint): boolean {
  const blockedIds = getBlockedUserIds();
  
  if (blockedIds.size === 0) {
    return false;
  }

  const userIdStr = String(userId);
  return blockedIds.has(userIdStr);
}

export function getBlockedUserIdsList(): string[] {
  const blockedIds = getBlockedUserIds();
  return Array.from(blockedIds);
}

export function logBlockedAccess(
  userId: string | number | bigint,
  context: string = 'login'
): void {
  console.warn(
    `[BLOCKLIST] Blocked access attempt by user ID ${userId} during ${context}`
  );
}
