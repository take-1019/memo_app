import { conversationId, messageId } from "../types";

/**
 * デモ用プロバイダ。
 * どのサービスも設定されていないときに、画面の動作確認用のサンプル会話を生成する。
 * 返信すると少し遅れて相手から自動返信が返る（ローカルのみ、外部送信なし）。
 */
const minutesAgo = (m) => new Date(Date.now() - m * 60 * 1000).toISOString();

const SAMPLE = [
	{
		service: "slack",
		external_id: "C0DEMO01",
		name: "#案件-ec-サイト制作",
		kind: "channel",
		url: "https://app.slack.com/",
		messages: [
			{ sender: "田中（PM）", text: "お疲れ様です！トップページのデザイン案、確認いただけましたか？", at: 95 },
			{ sender: "自分", text: "確認しました。ヒーロー画像を少し小さくしたいです。", at: 80, out: true },
			{ sender: "田中（PM）", text: "承知しました。修正版は明日の午前中にお送りします。", at: 12 },
		],
	},
	{
		service: "slack",
		external_id: "D0DEMO02",
		name: "佐藤 ゆき",
		kind: "dm",
		url: "https://app.slack.com/",
		messages: [{ sender: "佐藤 ゆき", text: "来週の定例、水曜 15:00 に変更できますか？", at: 35 }],
	},
	{
		service: "chatwork",
		external_id: "123456789",
		name: "株式会社サンプル × 開発チーム",
		kind: "group",
		url: "https://www.chatwork.com/",
		messages: [
			{ sender: "鈴木 一郎", text: "請求書を添付しました。ご確認お願いします。", at: 240 },
			{ sender: "自分", text: "受領しました。月末までに処理します。", at: 230, out: true },
			{ sender: "鈴木 一郎", text: "ありがとうございます。あと、来月の保守内容についても相談したいです。", at: 58 },
		],
	},
	{
		service: "line",
		external_id: "U0demo0003",
		name: "高橋 みなみ",
		kind: "dm",
		url: null,
		messages: [
			{ sender: "高橋 みなみ", text: "初めまして！ホームページ制作の見積もりをお願いしたいです。", at: 20 },
			{ sender: "高橋 みなみ", text: "ページ数は 5 ページくらいを想定しています。", at: 19 },
		],
	},
	{
		service: "discord",
		external_id: "998877665544",
		name: "#general",
		kind: "channel",
		url: "https://discord.com/",
		messages: [
			{ sender: "yamada_dev", text: "新しいバージョンをデプロイしました 🚀", at: 400 },
			{ sender: "kobayashi", text: "確認しました！問題なさそうです", at: 390 },
		],
	},
	{
		service: "teams",
		external_id: "19:demo-teams-chat@thread.v2",
		name: "伊藤 さくら",
		kind: "dm",
		url: "https://teams.microsoft.com/",
		messages: [
			{ sender: "伊藤 さくら", text: "明日の打ち合わせ資料、共有フォルダに入れておきました！", at: 48 },
			{ sender: "自分", text: "ありがとうございます、目を通しておきます。", at: 45, out: true },
			{ sender: "伊藤 さくら", text: "あと、開始を 10 分遅らせてもいいですか？", at: 8 },
		],
	},
	{
		service: "discord",
		external_id: "998877665599",
		name: "#サポート",
		kind: "channel",
		url: "https://discord.com/",
		messages: [{ sender: "user_1234", text: "ログインできなくなったのですが、どうすればいいですか？", at: 5 }],
	},
];

export const buildDemoData = () => {
	const conversations = [];
	const messages = [];
	for (const conv of SAMPLE) {
		const id = conversationId(conv.service, conv.external_id);
		conversations.push({
			id,
			service: conv.service,
			external_id: conv.external_id,
			name: conv.name,
			kind: conv.kind,
			url: conv.url,
			meta: { demo: true },
		});
		conv.messages.forEach((m, i) => {
			messages.push({
				id: messageId(conv.service, `${conv.external_id}:demo-${i}`),
				conversation_id: id,
				service: conv.service,
				external_id: `demo-${i}`,
				sender_id: m.out ? "me" : m.sender,
				sender_name: m.sender,
				sender_avatar: null,
				text: m.text,
				sent_at: minutesAgo(m.at),
				is_outgoing: Boolean(m.out),
				meta: { demo: true },
			});
		});
	}
	return { conversations, messages };
};

const AUTO_REPLIES = ["ありがとうございます！確認します。", "了解です、助かります🙏", "承知しました。また連絡します。"];

export const demoProvider = {
	id: "demo",
	label: "Demo",
	isConfigured: () => true,

	async sendReply(conversation, text) {
		const now = Date.now();
		return {
			id: messageId(conversation.service, `${conversation.external_id}:out-${now}`),
			conversation_id: conversation.id,
			service: conversation.service,
			external_id: `out-${now}`,
			sender_id: "me",
			sender_name: "自分",
			sender_avatar: null,
			text,
			sent_at: new Date(now).toISOString(),
			is_outgoing: true,
			meta: { demo: true },
		};
	},

	/** デモ用の自動返信（保存層に直接追加する） */
	async scheduleAutoReply(store, conversation) {
		const partner = (await store.listMessages(conversation.id)).find((m) => !m.is_outgoing);
		const now = Date.now() + 1;
		const reply = {
			id: messageId(conversation.service, `${conversation.external_id}:auto-${now}`),
			conversation_id: conversation.id,
			service: conversation.service,
			external_id: `auto-${now}`,
			sender_id: partner?.sender_id || "partner",
			sender_name: partner?.sender_name || "相手",
			sender_avatar: null,
			text: AUTO_REPLIES[now % AUTO_REPLIES.length],
			sent_at: new Date(now + 4000).toISOString(),
			is_outgoing: false,
			meta: { demo: true },
		};
		setTimeout(() => {
			store.upsertMessages([reply]).catch(() => {});
		}, 4000);
	},
};
