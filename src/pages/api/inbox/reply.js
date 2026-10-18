import { getStore } from "lib/inbox/store";
import { getProviderFor, demoProvider } from "lib/inbox/providers";
import { requireAuth, methodNotAllowed } from "lib/inbox/auth";

/**
 * POST /api/inbox/reply
 * body: { conversationId: string, text: string, threadTs?: string }
 * 会話のサービスに応じたプロバイダで送信し、送信済みメッセージを保存して返す。
 */
export default async function handler(req, res) {
	if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
	if (!requireAuth(req, res)) return;
	const { conversationId, text, threadTs } = req.body || {};
	if (!conversationId || !text || !text.trim()) {
		return res.status(400).json({ error: "conversationId と text は必須です" });
	}
	const store = getStore();
	const conversation = await store.getConversation(conversationId);
	if (!conversation) return res.status(404).json({ error: "会話が見つかりません" });

	try {
		const provider = getProviderFor(conversation);
		const message = await provider.sendReply(conversation, text.trim(), { threadTs });
		await store.upsertMessages([message]);
		await store.markRead(conversationId);
		if (provider === demoProvider) demoProvider.scheduleAutoReply(store, conversation);
		res.status(200).json({ message });
	} catch (err) {
		console.error("[inbox/reply]", err);
		res.status(502).json({ error: `送信に失敗しました: ${err.message}` });
	}
}
