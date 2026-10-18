import { requestJson, toIso } from "../http";
import { conversationId, messageId } from "../types";

/**
 * Slack 連携（Bot Token 方式）
 * 必要な環境変数: SLACK_BOT_TOKEN
 * 必要なスコープ: channels:read, groups:read, im:read, mpim:read,
 *               channels:history, groups:history, im:history, mpim:history,
 *               chat:write, users:read
 * Bot をチャンネルに招待（/invite @bot）した会話が取り込まれる。
 */
const SERVICE = "slack";
const API = "https://slack.com/api";

const slackApi = async (method, params = {}, { post = false } = {}) => {
	const token = process.env.SLACK_BOT_TOKEN;
	const options = post
		? {
				method: "POST",
				headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
				body: JSON.stringify(params),
		  }
		: { headers: { Authorization: `Bearer ${token}` } };
	const url = post ? `${API}/${method}` : `${API}/${method}?${new URLSearchParams(params)}`;
	const body = await requestJson(url, options);
	if (!body.ok) throw new Error(`Slack ${method}: ${body.error}`);
	return body;
};

const userCache = new Map();
const resolveUser = async (userId) => {
	if (!userId) return { name: "unknown", avatar: null };
	if (userCache.has(userId)) return userCache.get(userId);
	try {
		const { user } = await slackApi("users.info", { user: userId });
		const info = { name: user.profile?.display_name || user.real_name || user.name, avatar: user.profile?.image_48 || null };
		userCache.set(userId, info);
		return info;
	} catch (_) {
		const info = { name: userId, avatar: null };
		userCache.set(userId, info);
		return info;
	}
};

let selfCache = null;
const resolveSelf = async () => {
	if (selfCache) return selfCache;
	const auth = await slackApi("auth.test");
	selfCache = { userId: auth.user_id, teamId: auth.team_id, teamUrl: auth.url };
	return selfCache;
};

export const slackProvider = {
	id: SERVICE,
	label: "Slack",
	isConfigured: () => Boolean(process.env.SLACK_BOT_TOKEN),

	async fetchConversations() {
		const self = await resolveSelf();
		const result = [];
		let cursor;
		do {
			const res = await slackApi("conversations.list", {
				types: "public_channel,private_channel,im,mpim",
				exclude_archived: "true",
				limit: "200",
				...(cursor ? { cursor } : {}),
			});
			for (const ch of res.channels) {
				if (!ch.is_im && !ch.is_member) continue;
				let name = ch.name ? `#${ch.name}` : ch.id;
				let kind = "channel";
				if (ch.is_im) {
					const u = await resolveUser(ch.user);
					name = u.name;
					kind = "dm";
				} else if (ch.is_mpim) {
					kind = "group";
				}
				result.push({
					id: conversationId(SERVICE, ch.id),
					service: SERVICE,
					external_id: ch.id,
					name,
					kind,
					url: `https://app.slack.com/client/${self.teamId}/${ch.id}`,
					meta: { team_id: self.teamId },
				});
			}
			cursor = res.response_metadata?.next_cursor || null;
		} while (cursor);
		return result;
	},

	async fetchMessages(conversation, { limit = 50 } = {}) {
		const self = await resolveSelf();
		const res = await slackApi("conversations.history", { channel: conversation.external_id, limit: String(limit) });
		const messages = [];
		for (const m of res.messages) {
			if (m.subtype && m.subtype !== "bot_message" && m.subtype !== "thread_broadcast") continue;
			const isSelf = m.user === self.userId || Boolean(m.bot_id && m.user === undefined && m.username === undefined);
			const u = m.user ? await resolveUser(m.user) : { name: m.username || "bot", avatar: null };
			messages.push({
				id: messageId(SERVICE, `${conversation.external_id}:${m.ts}`),
				conversation_id: conversation.id,
				service: SERVICE,
				external_id: m.ts,
				sender_id: m.user || m.bot_id || null,
				sender_name: isSelf ? "自分" : u.name,
				sender_avatar: u.avatar,
				text: m.text || "",
				sent_at: toIso(Number(m.ts)),
				is_outgoing: isSelf,
				meta: { thread_ts: m.thread_ts || null },
			});
		}
		return messages;
	},

	async sendReply(conversation, text, { threadTs } = {}) {
		const res = await slackApi(
			"chat.postMessage",
			{ channel: conversation.external_id, text, ...(threadTs ? { thread_ts: threadTs } : {}) },
			{ post: true }
		);
		return {
			id: messageId(SERVICE, `${conversation.external_id}:${res.ts}`),
			conversation_id: conversation.id,
			service: SERVICE,
			external_id: res.ts,
			sender_id: null,
			sender_name: "自分",
			sender_avatar: null,
			text,
			sent_at: toIso(Number(res.ts)),
			is_outgoing: true,
			meta: { thread_ts: threadTs || null },
		};
	},
};
