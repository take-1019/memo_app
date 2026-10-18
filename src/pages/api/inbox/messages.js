import { getStore } from "lib/inbox/store";
import { requireAuth, methodNotAllowed } from "lib/inbox/auth";

export default async function handler(req, res) {
	if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
	if (!requireAuth(req, res)) return;
	const { conversationId } = req.query;
	if (!conversationId) return res.status(400).json({ error: "conversationId は必須です" });
	const store = getStore();
	const conversation = await store.getConversation(conversationId);
	if (!conversation) return res.status(404).json({ error: "会話が見つかりません" });
	const messages = await store.listMessages(conversationId);
	res.status(200).json({ conversation, messages });
}
