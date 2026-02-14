import crypto from 'crypto';
import axios from 'axios';

const BLOXLINK_API_BASE = 'https://api.blox.link/v4';
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY environment variable is required');
  return key;
}

export interface BloxlinkDiscordUser {
  id: string;
  username?: string;
  discriminator?: string;
  avatar?: string;
}

export interface BloxlinkUser {
  discordIDs: string[];
  primaryDiscordID?: string;
  robloxID: string;
  resolved: {
    discord?: BloxlinkDiscordUser[];
    roblox?: {
      id: number;
      username: string;
      displayName: string;
      avatar: string;
    };
  };
}

export interface BloxlinkLookupResponse {
  success: boolean;
  user?: BloxlinkUser;
  error?: string;
}

export class BloxlinkAPI {
  private apiKey: string;
  private guildId: string;

  constructor(apiKey: string, guildId: string) {
    this.apiKey = apiKey;
    this.guildId = guildId;
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any) {
    try {
      const response = await axios({
        method,
        url: `${BLOXLINK_API_BASE}${endpoint}`,
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json',
        },
        data,
        timeout: 10000,
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Invalid Bloxlink API key');
      }
      if (error.response?.status === 403) {
        throw new Error('Bloxlink API access denied');
      }
      if (error.response?.status === 400 && error.response?.data?.error === 'The bot must be in your server') {
        throw new Error('Bloxlink bot must be added to your Discord server');
      }
      if (error.response?.status === 404) {
        throw new Error('User not found in Bloxlink database');
      }
      if (error.response?.status === 429) {
        throw new Error('Bloxlink API rate limit exceeded');
      }
      throw new Error(`Bloxlink API error: ${error.message}`);
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      // Test with a dummy Discord user ID to see if API key works
      await this.makeRequest(`/public/guilds/${this.guildId}/discord-to-roblox/123456789012345678`);
      return true;
    } catch (error: any) {
      // If we get 404 (user not found), the API key is valid but user doesn't exist
      // If we get 401 (unauthorized), the API key is invalid
      // If we get 400 with "bot must be in server", that's also a validation issue
      if (error.message.includes('User not found') || error.response?.status === 404) {
        return true; // API key is valid, just no user found
      }
      if (error.message.includes('bot must be added')) {
        return false; // Bot not in server, can't validate properly
      }
      console.error('Bloxlink API validation failed:', error.message);
      return false;
    }
  }

  async lookupUserByRobloxId(robloxId: number): Promise<BloxlinkLookupResponse> {
    try {
      const response = await this.makeRequest(`/public/guilds/${this.guildId}/roblox-to-discord/${robloxId}`);

      if (!response || !response.discordIDs) {
        return {
          success: false,
          error: 'No Discord account linked to this Roblox user'
        };
      }

      return {
        success: true,
        user: {
          discordIDs: response.discordIDs,
          primaryDiscordID: response.discordIDs[0],
          robloxID: robloxId.toString(),
          resolved: {
            discord: response.discord || [],
            roblox: response.roblox || undefined
          }
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to lookup user'
      };
    }
  }

  async sendDiscordDM(discordId: string, content: string): Promise<boolean> {
    try {
      // Note: Bloxlink API doesn't support sending DMs directly
      // This would need to be implemented through Discord API instead
      throw new Error('Direct DM sending not supported by Bloxlink API');
    } catch {
      return false;
    }
  }
}

export function encryptApiKey(apiKey: string): string {
  const algorithm = 'aes-256-cbc';
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(getEncryptionKey(), salt, 32);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return salt.toString('hex') + ':' + iv.toString('hex') + ':' + encrypted;
}

export function decryptApiKey(encryptedApiKey: string): string {
  const algorithm = 'aes-256-cbc';
  const parts = encryptedApiKey.split(':');

  // Support legacy format (iv:encrypted) and new format (salt:iv:encrypted)
  let salt: Buffer, iv: Buffer, encrypted: string;
  if (parts.length === 3) {
    salt = Buffer.from(parts[0], 'hex');
    iv = Buffer.from(parts[1], 'hex');
    encrypted = parts[2];
  } else {
    salt = Buffer.from('salt');
    iv = Buffer.from(parts[0], 'hex');
    encrypted = parts[1];
  }

  const key = crypto.scryptSync(getEncryptionKey(), salt, 32);
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function formatNotificationMessage(
  action: 'promotion' | 'demotion' | 'warning',
  workspaceName: string,
  details: any,
  template?: any
): string {
  const actionLabels = {
    promotion: '🎉 You have been promoted!',
    demotion: '📉 You have been demoted',
    warning: '⚠️ You have received a warning'
  };

  let message = actionLabels[action];

  if (template && template[action]) {
    message = template[action]
      .replace('{workspace}', workspaceName)
      .replace('{user}', details.targetUser || 'Unknown')
      .replace('{role}', details.newRole || 'Unknown')
      .replace('{reason}', details.reason || 'No reason provided');
  } else {
    message += `\n\n**Workspace:** ${workspaceName}`;

    if (details.newRole) {
      message += `\n**${action === 'promotion' ? 'New Role' : 'Role'}:** ${details.newRole}`;
    }

    if (details.reason) {
      message += `\n**Reason:** ${details.reason}`;
    }

    if (details.issuedBy) {
      message += `\n**Issued by:** ${details.issuedBy}`;
    }
  }

  return message;
}

export default BloxlinkAPI;
