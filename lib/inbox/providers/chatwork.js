import { requestJson, toIso } from "../http";
import { conversationId, messageId } from "../types";

/**
 * Chatwork 連携
 * 必要な環境変数: CHATWORK_API_TOKEN
 * トークンの発行: Chatwork > 設定 > サービス連携 > API Token
 */
const SERVICE = "chatwork";
const API = "https://api.chatwork.com/v2";

const cwApi = async (path, { method = "GET", form } = {}) => {
	const headers = { "X-ChatWorkToken": process.env.CHATWORK_API_TOKEN };
	let body;
	if (form) {
		headers["Content-Type"] = "application/x-www-form-urlencoded";
		body = new URLSearchParams(form).toString();
	}
	return requestJson(`${API}${path}`, { method, headers, body });
};

let selfCache = null;
const resolveSelf = async () => {
	if (selfCache) return selfCache;
	selfCache = await cwApi("/me");
	return selfCache;
};

const stripTags = (text) =>
	(text || "")
		.replace(/\[To:\d+\]/g, "@")
		.replace(/\[rp aid=\d+ to=[\d-]+\]/g, "↩ ")
		.replace(/\[piconname:\d+\]/g, "")
		.replace(/\[\/?(info|title|hr|code|qt|qtmeta[^\]]*)\]/g, "")
		.trim();

export const chatworkProvider = {
	id: SERVICE,
	label: "Chatwork",
	isConfigured: () => Boolean(process.env.CHATWORK_API_TOKEN),

	async fetchConversations() {
		const rooms = await cwApi("/rooms");
		return rooms.map((room) => ({
			id: conversationId(SERVICE, String(room.room_id)),
			service: SERVICE,
			external_id: String(room.room_id),
			name: room.name,
			kind: room.type === "direct" ? "dm" : room.type === "my" ? "dm" : "group",
			url: `https://www.chatwork.com/#!rid${room.room_id}`,
			meta: { type: room.type, unread_num: room.unread_num, icon_path: room.icon_path },
		}));
	},

	async fetchMessages(conversation) {
		const self = await resolveSelf();
		// force=1 で最新 100 件を取得（0 だと未取得分のみ）
		const messages = (await cwApi(`/rooms/${conversation.external_id}/messages?force=1`)) || [];
		return messages.map((m) => ({
			id: messageId(SERVICE, `${conversation.external_id}:${m.message_id}`),
			conversation_id: conversation.id,
			service: SERVICE,
			external_id: String(m.message_id),
			sender_id: String(m.account.account_id),
			sender_name: m.account.account_id === self.account_id ? "自分" : m.account.name,
			sender_avatar: m.account.avatar_image_url || null,
			text: stripTags(m.body),
			sent_at: toIso(m.send_time),
			is_outgoing: m.account.account_id === self.account_id,
			meta: {},
		}));
	},

	async sendReply(conversation, text) {
		const res = await cwApi(`/rooms/${conversation.external_id}/messages`, { method: "POST", form: { body: text } });
		return {
			id: messageId(SERVICE, `${conversation.external_id}:${res.message_id}`),
			conversation_id: conversation.id,
			service: SERVICE,
			external_id: String(res.message_id),
			sender_id: null,
			sender_name: "自分",
			sender_avatar: null,
			text,
			sent_at: new Date().toISOString(),
			is_outgoing: true,
			meta: {},
		};
	},
};
