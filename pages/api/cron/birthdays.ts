import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";
import { getConfig } from "@/utils/configEngine";
import DiscordAPI, { decryptToken } from "@/utils/discord";
import { getRobloxThumbnail } from "@/utils/roblox";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cronSecret = req.headers["x-cron-secret"] || req.headers.authorization;
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    return res.status(500).json({ error: "CRON_SECRET not configured" });
  }

  if (!cronSecret || String(cronSecret) !== expectedSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const workspaces = await prisma.workspace.findMany({
      select: {
        groupId: true,
        groupName: true,
      },
    });

    const results = [];

    for (const workspace of workspaces) {
      try {
        // Check if Discord integration is set up for birthday notifications
        const discordIntegration = await prisma.discordIntegration.findUnique({
          where: { workspaceGroupId: workspace.groupId },
        });

        let useDiscordIntegration = false;
        let webhookConfig: any = null;

        if (discordIntegration && discordIntegration.isActive && discordIntegration.birthdayEnabled) {
          useDiscordIntegration = true;
        } else {
          // Fall back to webhook if no Discord integration
          webhookConfig = await getConfig("birthday_webhook", workspace.groupId);

          if (!webhookConfig || !webhookConfig.enabled || !webhookConfig.url) {
            continue;
          }
        }

        const embedColor = 0xff0099;

        const today = new Date();
        const todayDay = today.getDate();
        const todayMonth = today.getMonth() + 1;

        const membersWithBirthdays = await prisma.workspaceMember.findMany({
          where: {
            workspaceGroupId: workspace.groupId,
            user: {
              birthdayDay: todayDay,
              birthdayMonth: todayMonth,
            },
          },
          select: {
            discordId: true,
            user: {
              select: {
                userid: true,
                username: true,
                picture: true,
                birthdayDay: true,
                birthdayMonth: true,
              },
            },
          },
        });

        if (membersWithBirthdays.length === 0) {
          continue;
        }

        for (const member of membersWithBirthdays) {
          const user = member.user;

          if (useDiscordIntegration && discordIntegration) {
            try {
              const botToken = decryptToken(discordIntegration.botToken);
              const discord = new DiscordAPI(botToken);

              let avatarUrl: string | undefined;
              try {
                avatarUrl = await getRobloxThumbnail(Number(user.userid));
              } catch (avatarError) {
                avatarUrl = undefined;
              }

              const channelId = discordIntegration.birthdayChannelId || discordIntegration.channelId;

              const replaceVariables = (template: string) => {
                return template
                  .replace(/\{username\}/g, user.username || String(user.userid))
                  .replace(/\{userId\}/g, String(user.userid))
                  .replace(/\{workspace\}/g, workspace.groupName || 'Workspace')
                  .replace(/\{mention\}/g, member.discordId ? `<@${member.discordId}>` : user.username || String(user.userid));
              };

              const defaultTitle = "🎉 Birthday Celebration! 🎉";
              const defaultDescription = member.discordId
                ? `It's **{username}**'s birthday today! {mention}\n\nWish them a happy birthday!`
                : `It's **{username}**'s birthday today!\n\nWish them a happy birthday!`;
              const defaultColor = 0xFF0099;

              const message = {
                title: discordIntegration.birthdayEmbedTitle
                  ? replaceVariables(discordIntegration.birthdayEmbedTitle)
                  : defaultTitle,
                description: discordIntegration.birthdayEmbedDescription
                  ? replaceVariables(discordIntegration.birthdayEmbedDescription)
                  : replaceVariables(defaultDescription),
                color: discordIntegration.birthdayEmbedColor
                  ? parseInt(discordIntegration.birthdayEmbedColor.replace('#', ''), 16)
                  : defaultColor,
                thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
                footer: { text: workspace.groupName ? `${workspace.groupName} • Firefli` : 'Firefli Birthdays' },
              };

              await discord.sendMessage(channelId, message);

              results.push({
                workspace: workspace.groupName,
                user: user.username,
                status: "success",
                method: "discord_integration",
              });
            } catch (error: any) {
              console.error(`Discord birthday notification failed for ${user.username}:`, error);
              results.push({
                workspace: workspace.groupName,
                user: user.username,
                status: "failed",
                method: "discord_integration",
                error: error.message,
              });
            }
          } else {
            const colorHex = embedColor
              .toString(16)
              .toUpperCase()
              .padStart(6, "0");

            const embed: any = {
              title: "🎉 Birthday Celebration! 🎉",
              description: `It's **${user.username}**'s birthday today!\n\nWish them a happy birthday!`,
              color: embedColor,
              thumbnail: {
                url: `https://api.bloxy.services/avatar/${user.userid}/${colorHex}`,
              },
              timestamp: new Date().toISOString(),
            };

            if (workspace.groupName) {
              embed.footer = {
                text: `${workspace.groupName} | Firefli`,
              };
            }

            const webhookBody: any = {
              embeds: [embed],
              username: "Firefli Birthdays",
              avatar_url: `http://cdn.planetaryapp.us/brand/planetary.png`,
            };

            if (member.discordId) {
              webhookBody.content = `<@${member.discordId}>`;
            }

            const response = await fetch(webhookConfig.url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(webhookBody),
            });

            const responseText = await response.text();

            results.push({
              workspace: workspace.groupName,
              user: user.username,
              status: response.ok ? "success" : "failed",
              method: "webhook",
              statusCode: response.status,
              error: response.ok ? undefined : responseText,
            });
          }

          if (membersWithBirthdays.length > 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      } catch (error) {
        console.error(
          `Error processing birthdays for workspace ${workspace.groupId}:`,
          error
        );
        results.push({
          workspace: workspace.groupName,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return res.status(200).json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("Error in birthday cron job:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
