import { lineProvider } from "lib/inbox/providers/line";
import { getStore } from "lib/inbox/store";
import { readRawBody } from "lib/inbox/signature";

/**
 * LINE Messaging API の Webhook 受信口。
 * 署名検証のため生のリクエストボディが必要なので bodyParser を無効化している。
 */
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
	if (req.method !== "POST") {
		res.setHeader("Allow", "POST");
		return res.status(405).end();
	}
	const raw = await readRawBody(req);
	if (!lineProvider.verifySignature(raw, req.headers["x-line-signature"])) {
		return res.status(401).json({ error: "署名が一致しません" });
	}
	let body;
	try {
		body = JSON.parse(raw.toString("utf8") || "{}");
	} catch (_) {
		return res.status(400).json({ error: "invalid json" });
	}
	// サーバーレス環境では応答後の処理が打ち切られるため、取り込んでから応答する
	try {
		const { conversations, messages } = await lineProvider.ingestWebhookEvents(body.events || []);
		const store = getStore();
		await store.upsertConversations(conversations);
		await store.upsertMessages(messages);
	} catch (err) {
		console.error("[webhooks/line]", err);
	}
	res.status(200).json({ ok: true });
}
