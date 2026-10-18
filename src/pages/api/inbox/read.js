import { getStore } from "lib/inbox/store";
import { requireAuth, methodNotAllowed } from "lib/inbox/auth";

export default async function handler(req, res) {
	if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
	if (!requireAuth(req, res)) return;
	const { conversationId } = req.body || {};
	if (!conversationId) return res.status(400).json({ error: "conversationId は必須です" });
	const conversation = await getStore().markRead(conversationId);
	res.status(200).json({ conversation });
}
