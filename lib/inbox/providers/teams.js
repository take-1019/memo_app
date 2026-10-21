import { toIso } from "../http";
import { conversationId, messageId } from "../types";
import { isServiceConfigured } from "../config";
import { htmlToText, textToHtml } from "../html";
import { graph, getAccount, channelsEnabled, NotConnectedError } from "../microsoft";

/**
 * Microsoft Teams 連携（Microsoft Graph・委任アクセス）
 * ログインしたユーザー本人として、チャットを読み取り、本人として返信する。
 * 個人用 Microsoft アカウントの Teams は Graph のチャット API が非対応のため使えない。
 */
const SERVICE = "teams";
const CHAT_LIMIT = 50; // 最近やりとりのあったチャット 50 件まで取り込む
const enc = encodeURIComponent;

const requireUser = async () => {
	const account = await getAccount();
	if (!account?.user) throw new NotConnectedError();
	return account.user;
};

/** 件名のないチャットは参加者名から表示名を作る */
const resolveChatName = async (chat, me) => {
	try {
		const { value } = await graph(`/chats/${chat.id}/members`);
		const others = value.filter((m) => m.userId !== me.id).map((m) => m.displayName).filter(Boolean);
		if (others.length === 0) return chat.chatType === "oneOnOne" ? "自分とのチャット" : "Teams チャット";
		if (chat.chatType === "oneOnOne") return others[0];
		return others.length > 3 ? `${others.slice(0, 3).join("、")} 他${others.length - 3}名` : others.join("、");
	} catch (_) {
		return "Teams チャット";
	}
};

const fetchChats = async (me, previous) => {
	const res = await graph(`/me/chats?$expand=lastMessagePreview&$orderby=${enc("lastMessagePreview/createdDateTime desc")}&$top=${CHAT_LIMIT}`);
	const result = [];
	for (const chat of res.value || []) {
		const id = conversationId(SERVICE, chat.id);
		const name = chat.topic || previous?.get(id)?.name || (await resolveChatName(chat, me));
		result.push({
			id,
			service: SERVICE,
			external_id: chat.id,
			name,
			kind: chat.chatType === "oneOnOne" ? "dm" : "group",
			url: chat.webUrl || null,
			// 最終メッセージが変わったチャットだけメッセージを取りに行く
			meta: { type: "chat", chat_type: chat.chatType, version: chat.lastMessagePreview?.id || null },
		});
	}
	return result;
};

const fetchChannels = async () => {
	const { value: teams = [] } = await graph(`/me/joinedTeams?$select=id,displayName`);
	const result = [];
	for (const team of teams) {
		const { value: channels = [] } = await graph(`/teams/${team.id}/channels?$select=id,displayName,webUrl`);
		for (const ch of channels) {
			result.push({
				id: conversationId(SERVICE, ch.id),
				service: SERVICE,
				external_id: ch.id,
				name: `${team.displayName} / #${ch.displayName}`,
				kind: "channel",
				url: ch.webUrl || null,
				meta: { type: "channel", team_id: team.id, channel_id: ch.id },
			});
		}
	}
	return result;
};

const toMessage = (conversation, m, me) => {
	if (m.messageType !== "message" || m.deletedDateTime) return null;
	const user = m.from?.user;
	const isSelf = Boolean(user && user.id === me.id);
	let text = m.body?.contentType === "html" ? htmlToText(m.body.content) : (m.body?.content || "").trim();
	if (!text && m.attachments?.length) text = `[添付 ${m.attachments.length} 件]`;
	if (m.subject) text = `【${m.subject}】\n${text}`;
	return {
		id: messageId(SERVICE, `${conversation.external_id}:${m.id}`),
		conversation_id: conversation.id,
		service: SERVICE,
		external_id: m.id,
		sender_id: user?.id || m.from?.application?.id || null,
		sender_name: isSelf ? "自分" : user?.displayName || m.from?.application?.displayName || "不明",
		sender_avatar: null,
		text,
		sent_at: toIso(m.createdDateTime),
		is_outgoing: isSelf,
		meta: { reply_to_id: m.replyToId || null },
	};
};

const messagesPath = (conversation) =>
	conversation.meta?.type === "channel"
		? `/teams/${conversation.meta.team_id}/channels/${conversation.meta.channel_id}/messages`
		: `/chats/${conversation.external_id}/messages`;

export const teamsProvider = {
	id: SERVICE,
	label: "Teams",
	isConfigured: () => isServiceConfigured(SERVICE),
	// 管理者が設定した環境変数に加えて、画面からのサインインが必要
	needsLogin: true,

	async getConnection() {
		const account = await getAccount();
		return account?.refresh_token ? { connected: true, user: account.user } : { connected: false };
	},

	async fetchConversations({ previous } = {}) {
		const me = await requireUser();
		const chats = await fetchChats(me, previous);
		const channels = channelsEnabled() ? await fetchChannels() : [];
		return [...chats, ...channels];
	},

	async fetchMessages(conversation, { limit = 50 } = {}) {
		const me = await requireUser();
		const top = Math.min(Math.max(limit, 1), 50);
		const order = conversation.meta?.type === "channel" ? "" : `&$orderby=${enc("createdDateTime desc")}`;
		const res = await graph(`${messagesPath(conversation)}?$top=${top}${order}`);
		return (res.value || []).map((m) => toMessage(conversation, m, me)).filter(Boolean);
	},

	async sendReply(conversation, text) {
		const me = await requireUser();
		const m = await graph(messagesPath(conversation), {
			method: "POST",
			body: JSON.stringify({ body: { contentType: "html", content: textToHtml(text) } }),
		});
		return toMessage(conversation, { ...m, messageType: m.messageType || "message", from: m.from || { user: { id: me.id } } }, me) || {
			id: messageId(SERVICE, `${conversation.external_id}:${m.id}`),
			conversation_id: conversation.id,
			service: SERVICE,
			external_id: m.id,
			sender_id: me.id,
			sender_name: "自分",
			sender_avatar: null,
			text,
			sent_at: toIso(m.createdDateTime),
			is_outgoing: true,
			meta: {},
		};
	},
};
