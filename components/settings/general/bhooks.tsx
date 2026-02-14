import { useState, useEffect } from "react";
import { useRecoilState } from "recoil";
import { workspacestate } from "@/state";
import axios from "axios";
import toast from "react-hot-toast";
import { useRouter } from "next/router";
import { IconGift, IconCheck, IconX, IconBrandDiscord } from "@tabler/icons-react";

function BirthdayWebhook() {
  const [workspace, setWorkspace] = useRecoilState(workspacestate);
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  // Discord integration state
  const [hasDiscordIntegration, setHasDiscordIntegration] = useState(false);
  const [discordChannels, setDiscordChannels] = useState<Array<{id: string, name: string}>>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [useDiscordIntegration, setUseDiscordIntegration] = useState(false);

  useEffect(() => {
    if (router.query.id) {
      // Fetch Discord integration status
      axios
        .get(`/api/workspace/${router.query.id}/settings/discord/status`)
        .then((res) => {
          if (res.data?.success && res.data.integration) {
            const integration = res.data.integration;
            setHasDiscordIntegration(true);
            setUseDiscordIntegration(integration.birthdayEnabled);
            setSelectedChannelId(integration.birthdayChannelId || "");

            // Fetch available channels for this Discord integration
            axios.get(`/api/workspace/${router.query.id}/settings/discord/integration-channels`)
              .then((channelsRes) => {
                if (channelsRes?.data?.success) {
                  setDiscordChannels([
                    { id: "", name: `Use main channel (#${integration.channelName})` },
                    ...channelsRes.data.channels
                      .filter((ch: any) => ch.id !== integration.channelId) // Don't duplicate main channel
                      .map((ch: any) => ({
                        id: ch.id,
                        name: ch.name
                      }))
                  ]);
                }
              })
              .catch((err) => {
                console.error("Failed to fetch Discord channels:", err);
                // Fallback to just main channel option
                setDiscordChannels([
                  { id: "", name: `Use main channel (#${integration.channelName})` }
                ]);
              });
          }
        })
        .catch(() => {
          // If Discord integration fails, fall back to webhook
          setHasDiscordIntegration(false);
        });

      // Also fetch webhook config as fallback
      axios
        .get(`/api/workspace/${router.query.id}/settings/general/birthdays/hook`)
        .then((res) => {
          if (res.data.value) {
            if (!hasDiscordIntegration) {
              setEnabled(res.data.value.enabled || false);
            }
            setWebhookUrl(res.data.value.url || "");
          }
        })
        .catch((err) => {
          console.error("Error fetching birthday webhook config:", err);
        });
    }
  }, [router.query.id, hasDiscordIntegration]);

  const handleSave = async () => {
    setLoading(true);
    try {
      if (hasDiscordIntegration && useDiscordIntegration) {
        // Update Discord integration
        const currentIntegration = await axios.get(`/api/workspace/${router.query.id}/settings/discord/status`);
        const integration = currentIntegration.data.integration;

        await axios.post(`/api/workspace/${router.query.id}/settings/discord/configure`, {
          botToken: "existing", // Signal to use existing token
          guildId: integration.guildId,
          channelId: integration.channelId,
          enabledEvents: integration.enabledEvents,
          guildName: integration.guildName,
          channelName: integration.channelName,
          birthdayChannelId: selectedChannelId || null,
          birthdayChannelName: selectedChannelId ? discordChannels.find(ch => ch.id === selectedChannelId)?.name || null : null,
          birthdayEnabled: useDiscordIntegration,
        });
        toast.success("Discord birthday settings saved!");
      } else {
        // Use webhook fallback
        await axios.patch(
          `/api/workspace/${router.query.id}/settings/general/birthdays/hook`,
          {
            enabled,
            url: webhookUrl,
          }
        );
        toast.success("Birthday webhook settings saved!");
      }
    } catch (error) {
      console.error("Error saving birthday settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!webhookUrl) {
      toast.error("Please enter a webhook URL first");
      return;
    }

    setTesting(true);
    try {
      const response = await axios.post(
        `/api/workspace/${router.query.id}/settings/general/birthdays/test`,
        { url: webhookUrl }
      );

      if (response.data.success) {
        toast.success("Test message sent successfully!");
      } else {
        toast.error("Failed to send test message");
      }
    } catch (error: any) {
      console.error("Error testing webhook:", error);
      toast.error(error.response?.data?.error || "Failed to send test message");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Send Discord notifications when it's someone's birthday
        </p>
      </div>

      {hasDiscordIntegration && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <IconBrandDiscord className="w-5 h-5 text-[#5865F2]" />
            <h4 className="font-medium text-blue-800 dark:text-blue-200">Discord Integration Available</h4>
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            You have a Discord bot integration configured. Birthday notifications can use this instead of webhooks.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {hasDiscordIntegration ? (
          <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
            <div>
              <p className="font-medium text-zinc-900 dark:text-white">
                Use Discord Integration for Birthdays
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Send birthday notifications through your configured Discord bot
              </p>
            </div>
            <button
              onClick={() => setUseDiscordIntegration(!useDiscordIntegration)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                useDiscordIntegration ? "bg-primary" : "bg-zinc-300 dark:bg-zinc-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  useDiscordIntegration ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
            <div>
              <p className="font-medium text-zinc-900 dark:text-white">
                Enable Birthday Notifications
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Automatically send Discord messages for birthdays via webhook
              </p>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabled ? "bg-primary" : "bg-zinc-300 dark:bg-zinc-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        )}

        {hasDiscordIntegration && useDiscordIntegration && discordChannels.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Birthday Channel (Optional)
            </label>
            <select
              value={selectedChannelId}
              onChange={(e) => setSelectedChannelId(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {discordChannels.map(channel => (
                <option key={channel.id} value={channel.id}>
                  {channel.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Choose a specific channel for birthday notifications, or use the main integration channel
            </p>
          </div>
        )}

        {(!hasDiscordIntegration || !useDiscordIntegration) && enabled && (
          <>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Discord Webhook URL
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleTest}
                disabled={testing || !webhookUrl}
                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing ? "Sending..." : "Send Test Message"}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <IconCheck className="w-4 h-4" />
          {loading ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

BirthdayWebhook.title = "Birthday Notifications";

export default BirthdayWebhook;
