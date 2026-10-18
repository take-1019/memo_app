import { getStore } from "./store";
import { getConfiguredProviders, isDemoMode } from "./providers";
import { buildDemoData } from "./providers/demo";

/**
 * 設定済みの全サービスから会話とメッセージを取り込み、保存層に反映する。
 * 戻り値はサービス毎の結果（取り込み件数 or エラー）。
 */
export const syncAll = async ({ messagesPerConversation = 50 } = {}) => {
	const store = getStore();
	const results = {};

	if (isDemoMode()) {
		await ensureDemoData(store);
		results.demo = { conversations: 6, newMessages: 0, note: "デモデータ" };
		return results;
	}

	await Promise.all(
		getConfiguredProviders().map(async (provider) => {
			if (provider.webhookOnly) {
				results[provider.id] = { conversations: 0, newMessages: 0, note: "Webhook 受信のみ" };
				return;
			}
			try {
				const conversations = await provider.fetchConversations();
				await store.upsertConversations(conversations);
				let newMessages = 0;
				for (const conv of conversations) {
					const messages = await provider.fetchMessages(conv, { limit: messagesPerConversation });
					const inserted = await store.upsertMessages(messages);
					newMessages += inserted.length;
				}
				results[provider.id] = { conversations: conversations.length, newMessages };
			} catch (err) {
				results[provider.id] = { error: err.message };
			}
		})
	);
	return results;
};

export const ensureDemoData = async (store) => {
	if (store.seeded) return;
	if (store.kind !== "memory") {
		// Supabase 利用時は、空のときだけデモデータを入れる
		const existing = await store.listConversations();
		if (existing.length > 0) {
			store.seeded = true;
			return;
		}
	}
	const { conversations, messages } = buildDemoData();
	await store.upsertConversations(conversations);
	await store.upsertMessages(messages);
	store.seeded = true;
};
