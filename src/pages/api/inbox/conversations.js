import { getStore } from "lib/inbox/store";
import { isDemoMode } from "lib/inbox/providers";
import { ensureDemoData } from "lib/inbox/sync";
import { requireAuth, methodNotAllowed } from "lib/inbox/auth";

export default async function handler(req, res) {
	if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
	if (!requireAuth(req, res)) return;
	const store = getStore();
	if (isDemoMode()) await ensureDemoData(store);
	const { service, unread, q } = req.query;
	const conversations = await store.listConversations({
		service: service || undefined,
		unreadOnly: unread === "1" || unread === "true",
		q: q || undefined,
	});
	res.status(200).json({ conversations });
}
