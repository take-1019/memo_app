import crypto from "crypto";
import { slackProvider } from "lib/inbox/providers/slack";
import { getStore } from "lib/inbox/store";

/**
 * Slack Events API の受信口（任意）。
 * 定期同期だけでも動くが、これを設定するとメッセージが即時に反映される。
 * 環境変数: SLACK_SIGNING_SECRET
 * 購読イベント: message.channels, message.groups, message.im, message.mpim
 */
export const config = { api: { bodyParser: false } };

const readRawBody = (req) =>
	new Promise((resolve, reject) => {
		const chunks = [];
		req.on("data", (c) => chunks.push(c));
		req.on("end", () => resolve(Buffer.concat(chunks)));
		req.on("error", reject);
	});

const verify = (raw, req) => {
	const secret = process.env.SLACK_SIGNING_SECRET;
	if (!secret) return true;
	const ts = req.headers["x-slack-request-timestamp"];
	const sig = req.headers["x-slack-signature"];
	if (!ts || !sig) return false;
	if (Math.abs(Date.now() / 1000 - Number(ts)) > 60 * 5) return false;
	const expected = `v0=${crypto.createHmac("sha256", secret).update(`v0:${ts}:${raw}`).digest("hex")}`;
	return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
};

export default async function handler(req, res) {
	if (req.method !== "POST") {
		res.setHeader("Allow", "POST");
		return res.status(405).end();
	}
	const raw = (await readRawBody(req)).toString("utf8");
	if (!verify(raw, req)) return res.status(401).json({ error: "署名が一致しません" });
	const body = JSON.parse(raw || "{}");

	if (body.type === "url_verification") return res.status(200).json({ challenge: body.challenge });
	res.status(200).json({ ok: true });

	const ev = body.event;
	if (!ev || ev.type !== "message" || !slackProvider.isConfigured()) return;
	try {
		const store = getStore();
		const convId = `slack:${ev.channel}`;
		let conversation = await store.getConversation(convId);
		if (!conversation) {
			const all = await slackProvider.fetchConversations();
			await store.upsertConversations(all);
			conversation = all.find((c) => c.id === convId);
			if (!conversation) return;
		}
		const messages = await slackProvider.fetchMessages(conversation, { limit: 20 });
		await store.upsertMessages(messages);
	} catch (err) {
		console.error("[webhooks/slack]", err);
	}
}
