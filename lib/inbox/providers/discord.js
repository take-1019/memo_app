import { requestJson, toIso } from "../http";
import { conversationId, messageId } from "../types";

/**
 * Discord 連携（Bot Token 方式）
 * 必要な環境変数: DISCORD_BOT_TOKEN, DISCORD_GUILD_ID
 * Bot に必要な権限: View Channels, Read Message History, Send Messages
 * Developer Portal で "Message Content Intent" を有効にすること（本文取得に必要）。
 */
const SERVICE = "discord";
const API = "https://discord.com/api/v10";

const dcApi = (path, options = {}) =>
	requestJson(`${API}${path}`, {
		...options,
		headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json", ...(options.headers || {}) },
	});

let selfCache = null;
const resolveSelf = async () => {
	if (selfCache) return selfCache;
	selfCache = await dcApi("/users/@me");
	return selfCache;
};

const avatarUrl = (user) => (user?.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64` : null);

export const discordProvider = {
	id: SERVICE,
	label: "Discord",
	isConfigured: () => Boolean(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_GUILD_ID),

	async fetchConversations() {
		const guildId = process.env.DISCORD_GUILD_ID;
		const channels = await dcApi(`/guilds/${guildId}/channels`);
		return channels
			.filter((ch) => ch.type === 0) // 0 = GUILD_TEXT
			.map((ch) => ({
				id: conversationId(SERVICE, ch.id),
				service: SERVICE,
				external_id: ch.id,
				name: `#${ch.name}`,
				kind: "channel",
				url: `https://discord.com/channels/${guildId}/${ch.id}`,
				meta: { guild_id: guildId },
			}));
	},

	async fetchMessages(conversation, { limit = 50 } = {}) {
		const self = await resolveSelf();
		let messages;
		try {
			messages = await dcApi(`/channels/${conversation.external_id}/messages?limit=${limit}`);
		} catch (err) {
			// 権限のないチャンネルはスキップ
			if (String(err.message).includes("-> 403")) return [];
			throw err;
		}
		return messages.map((m) => ({
			id: messageId(SERVICE, `${conversation.external_id}:${m.id}`),
			conversation_id: conversation.id,
			service: SERVICE,
			external_id: m.id,
			sender_id: m.author.id,
			sender_name: m.author.id === self.id ? "自分" : m.author.global_name || m.author.username,
			sender_avatar: avatarUrl(m.author),
			text: m.content || (m.attachments?.length ? `[添付 ${m.attachments.length} 件]` : ""),
			sent_at: toIso(m.timestamp),
			is_outgoing: m.author.id === self.id,
			meta: {},
		}));
	},

	async sendReply(conversation, text) {
		const m = await dcApi(`/channels/${conversation.external_id}/messages`, { method: "POST", body: JSON.stringify({ content: text }) });
		return {
			id: messageId(SERVICE, `${conversation.external_id}:${m.id}`),
			conversation_id: conversation.id,
			service: SERVICE,
			external_id: m.id,
			sender_id: m.author.id,
			sender_name: "自分",
			sender_avatar: null,
			text,
			sent_at: toIso(m.timestamp),
			is_outgoing: true,
			meta: {},
		};
	},
};
