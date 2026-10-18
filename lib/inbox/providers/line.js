import crypto from "crypto";
import { requestJson, toIso } from "../http";
import { conversationId, messageId } from "../types";
import { safeEqual, allowUnsigned } from "../signature";

/**
 * LINE 公式アカウント（Messaging API）連携
 * 必要な環境変数: LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET
 *
 * LINE には履歴取得 API が無いため、受信は Webhook（/api/webhooks/line）で行う。
 * LINE Developers コンソールで Webhook URL に
 *   https://<デプロイ先ドメイン>/api/webhooks/line
 * を設定し、「Webhook の利用」を ON にする。
 * 返信は、相手のメッセージを受信してから約 1 分以内なら無料の「応答メッセージ」、
 * それ以降は「プッシュメッセージ」（無料プランは月 200 通まで）で送る。
 */
const SERVICE = "line";
const API = "https://api.line.me/v2/bot";
// 応答トークンの有効期限は受信から約 1 分。余裕を見て 50 秒以内のものだけ使う
const REPLY_TOKEN_TTL_MS = 50 * 1000;

const lineApi = (path, options = {}) =>
	requestJson(`${API}${path}`, {
		...options,
		headers: {
			Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
			"Content-Type": "application/json",
			...(options.headers || {}),
		},
	});

const profileCache = new Map();
const resolveProfile = async (source) => {
	const key = `${source.type}:${source.userId || source.groupId || source.roomId}`;
	if (profileCache.has(key)) return profileCache.get(key);
	let profile = { displayName: null, pictureUrl: null };
	try {
		if (source.type === "user") profile = await lineApi(`/profile/${source.userId}`);
		else if (source.type === "group" && source.userId) profile = await lineApi(`/group/${source.groupId}/member/${source.userId}`);
		else if (source.type === "room" && source.userId) profile = await lineApi(`/room/${source.roomId}/member/${source.userId}`);
	} catch (_) {
		// 友だち追加していないユーザー等はプロフィール取得不可
	}
	profileCache.set(key, profile);
	return profile;
};

const describeMessage = (message) => {
	switch (message.type) {
		case "text":
			return message.text;
		case "image":
			return "[画像]";
		case "video":
			return "[動画]";
		case "audio":
			return "[音声]";
		case "file":
			return `[ファイル] ${message.fileName || ""}`.trim();
		case "location":
			return `[位置情報] ${message.address || message.title || ""}`.trim();
		case "sticker":
			return "[スタンプ]";
		default:
			return `[${message.type}]`;
	}
};

export const lineProvider = {
	id: SERVICE,
	label: "LINE",
	isConfigured: () => Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
	// 履歴取得 API が無いので同期では何もしない（Webhook で蓄積）
	webhookOnly: true,

	async fetchConversations() {
		return [];
	},
	async fetchMessages() {
		return [];
	},

	verifySignature(rawBody, signature) {
		const secret = process.env.LINE_CHANNEL_SECRET;
		if (!secret) return allowUnsigned(); // 本番ではシークレット必須
		const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
		return safeEqual(expected, signature);
	},

	/** Webhook のイベント配列を会話・メッセージに変換する */
	async ingestWebhookEvents(events) {
		const conversations = new Map();
		const messages = [];
		for (const ev of events) {
			if (ev.type !== "message" || !ev.source) continue;
			const src = ev.source;
			const targetId = src.groupId || src.roomId || src.userId;
			if (!targetId) continue;
			const profile = await resolveProfile(src);
			const convId = conversationId(SERVICE, targetId);
			const kind = src.type === "user" ? "dm" : "group";
			const name = kind === "dm" ? profile.displayName || `LINE ユーザー ${targetId.slice(-6)}` : `LINE グループ ${targetId.slice(-6)}`;
			if (!conversations.has(convId)) {
				conversations.set(convId, {
					id: convId,
					service: SERVICE,
					external_id: targetId,
					name,
					kind,
					url: null,
					meta: { source_type: src.type, picture_url: profile.pictureUrl || null },
				});
			}
			messages.push({
				id: messageId(SERVICE, ev.message.id),
				conversation_id: convId,
				service: SERVICE,
				external_id: ev.message.id,
				sender_id: src.userId || null,
				sender_name: profile.displayName || "LINE ユーザー",
				sender_avatar: profile.pictureUrl || null,
				text: describeMessage(ev.message),
				sent_at: toIso(ev.timestamp),
				is_outgoing: false,
				meta: { reply_token: ev.replyToken || null, message_type: ev.message.type },
			});
		}
		return { conversations: [...conversations.values()], messages };
	},

	async sendReply(conversation, text, { recentMessages = [] } = {}) {
		const payload = [{ type: "text", text }];
		// 受信直後なら応答トークンで返信する（通数にカウントされない）
		const fresh = recentMessages
			.filter((m) => !m.is_outgoing && m.meta?.reply_token && Date.now() - new Date(m.sent_at).getTime() < REPLY_TOKEN_TTL_MS)
			.at(-1);
		let via = "push";
		if (fresh) {
			try {
				await lineApi("/message/reply", { method: "POST", body: JSON.stringify({ replyToken: fresh.meta.reply_token, messages: payload }) });
				via = "reply";
			} catch (_) {
				// 期限切れ・使用済みならプッシュに切り替える
			}
		}
		if (via === "push") {
			await lineApi("/message/push", { method: "POST", body: JSON.stringify({ to: conversation.external_id, messages: payload }) });
		}
		const now = new Date();
		return {
			id: messageId(SERVICE, `out:${conversation.external_id}:${now.getTime()}`),
			conversation_id: conversation.id,
			service: SERVICE,
			external_id: `out:${now.getTime()}`,
			sender_id: null,
			sender_name: "自分",
			sender_avatar: null,
			text,
			sent_at: now.toISOString(),
			is_outgoing: true,
			meta: { via },
		};
	},
};
