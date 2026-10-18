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
				const prevMap = new Map((await store.listConversations({ service: provider.id })).map((c) => [c.id, c]));
				const isChanged = (conv) => {
					const prev = prevMap.get(conv.id);
					const version = conv.meta?.version;
					return !prev || version === undefined || version === null || prev.meta?.version !== version;
				};
				const changed = conversations.filter(isChanged);
				// 取得が終わるまで version は前の値のままにしておく（途中で失敗しても次回やり直せる）
				await store.upsertConversations(
					conversations.map((c) => (isChanged(c) ? { ...c, meta: { ...c.meta, version: prevMap.get(c.id)?.meta?.version ?? null } } : c))
				);
				let newMessages = 0;
				for (const conv of changed) {
					const messages = await provider.fetchMessages(conv, { limit: messagesPerConversation });
					const inserted = await store.upsertMessages(messages);
					await store.upsertConversations([conv]);
					newMessages += inserted.length;
				}
				results[provider.id] = { conversations: conversations.length, checked: changed.length, newMessages };
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
