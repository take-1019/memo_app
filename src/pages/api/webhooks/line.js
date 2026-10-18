import { lineProvider } from "lib/inbox/providers/line";
import { getStore } from "lib/inbox/store";

/**
 * LINE Messaging API の Webhook 受信口。
 * 署名検証のため生のリクエストボディが必要なので bodyParser を無効化している。
 */
export const config = { api: { bodyParser: false } };

const readRawBody = (req) =>
	new Promise((resolve, reject) => {
		const chunks = [];
		req.on("data", (c) => chunks.push(c));
		req.on("end", () => resolve(Buffer.concat(chunks)));
		req.on("error", reject);
	});

export default async function handler(req, res) {
	if (req.method !== "POST") {
		res.setHeader("Allow", "POST");
		return res.status(405).end();
	}
	const raw = await readRawBody(req);
	const signature = req.headers["x-line-signature"];
	if (!lineProvider.verifySignature(raw, signature)) {
		return res.status(401).json({ error: "署名が一致しません" });
	}
	let body;
	try {
		body = JSON.parse(raw.toString("utf8") || "{}");
	} catch (_) {
		return res.status(400).json({ error: "invalid json" });
	}
	// LINE は 200 を素早く返す必要があるため、取り込みは待たずに応答する
	res.status(200).json({ ok: true });
	try {
		const { conversations, messages } = await lineProvider.ingestWebhookEvents(body.events || []);
		const store = getStore();
		await store.upsertConversations(conversations);
		await store.upsertMessages(messages);
	} catch (err) {
		console.error("[webhooks/line]", err);
	}
}
