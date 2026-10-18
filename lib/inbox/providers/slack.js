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
	selfCache = { userId: auth.user_id, botId: auth.bot_id || null, teamId: auth.team_id };
	return selfCache;
};

const toConversation = async (ch, self) => {
	let name = ch.name ? `#${ch.name}` : ch.id;
	let kind = "channel";
	if (ch.is_im) {
		name = (await resolveUser(ch.user)).name;
		kind = "dm";
	} else if (ch.is_mpim) {
		kind = "group";
	}
	return {
		id: conversationId(SERVICE, ch.id),
		service: SERVICE,
		external_id: ch.id,
		name,
		kind,
		url: `https://app.slack.com/client/${self.teamId}/${ch.id}`,
		meta: { team_id: self.teamId },
	};
};

const IGNORED_SUBTYPES = new Set(["message_changed", "message_deleted", "channel_join", "channel_leave", "channel_topic", "channel_purpose", "channel_name"]);

/** Slack のメッセージオブジェクト（履歴 API / Events API 共通）を共通形式に変換する */
const toMessage = async (conversation, m, self) => {
	if (m.subtype && IGNORED_SUBTYPES.has(m.subtype)) return null;
	const isSelf = m.user === self.userId || (self.botId && m.bot_id === self.botId);
	const u = m.user ? await resolveUser(m.user) : { name: m.username || "bot", avatar: null };
	return {
		id: messageId(SERVICE, `${conversation.external_id}:${m.ts}`),
		conversation_id: conversation.id,
		service: SERVICE,
		external_id: m.ts,
		sender_id: m.user || m.bot_id || null,
		sender_name: isSelf ? "自分" : u.name,
		sender_avatar: isSelf ? null : u.avatar,
		text: m.text || (m.files?.length ? `[ファイル ${m.files.length} 件]` : ""),
		sent_at: toIso(Number(m.ts)),
		is_outgoing: Boolean(isSelf),
		meta: { thread_ts: m.thread_ts || null },
	};
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
				result.push(await toConversation(ch, self));
			}
			cursor = res.response_metadata?.next_cursor || null;
		} while (cursor);
		return result;
	},

	/** 1 チャンネル分の会話情報を取得する（Webhook で未知のチャンネルから届いたとき用） */
	async fetchConversation(channelId) {
		const self = await resolveSelf();
		const { channel } = await slackApi("conversations.info", { channel: channelId });
		return toConversation(channel, self);
	},

	async fetchMessages(conversation, { limit = 50 } = {}) {
		const self = await resolveSelf();
		const res = await slackApi("conversations.history", { channel: conversation.external_id, limit: String(limit) });
		const messages = [];
		for (const m of res.messages) {
			const msg = await toMessage(conversation, m, self);
			if (msg) messages.push(msg);
		}
		return messages;
	},

	/** Events API の message イベントを共通形式に変換する */
	async messageFromEvent(conversation, event) {
		const self = await resolveSelf();
		return toMessage(conversation, event, self);
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
