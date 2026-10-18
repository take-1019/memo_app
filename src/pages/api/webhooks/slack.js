import crypto from "crypto";
import { slackProvider } from "lib/inbox/providers/slack";
import { getStore } from "lib/inbox/store";
import { safeEqual, allowUnsigned, readRawBody } from "lib/inbox/signature";

/**
 * Slack Events API の受信口（任意）。
 * 定期同期だけでも動くが、これを設定するとメッセージが即時に反映される。
 * 環境変数: SLACK_SIGNING_SECRET
 * 購読イベント: message.channels, message.groups, message.im, message.mpim
 */
export const config = { api: { bodyParser: false } };

const verify = (raw, req) => {
	const secret = process.env.SLACK_SIGNING_SECRET;
	if (!secret) return allowUnsigned();
	const ts = req.headers["x-slack-request-timestamp"];
	const sig = req.headers["x-slack-signature"];
	if (!ts || !sig) return false;
	if (Math.abs(Date.now() / 1000 - Number(ts)) > 60 * 5) return false;
	const expected = `v0=${crypto.createHmac("sha256", secret).update(`v0:${ts}:${raw}`).digest("hex")}`;
	return safeEqual(expected, sig);
};

export default async function handler(req, res) {
	if (req.method !== "POST") {
		res.setHeader("Allow", "POST");
		return res.status(405).end();
	}
	const raw = (await readRawBody(req)).toString("utf8");
	if (!verify(raw, req)) return res.status(401).json({ error: "署名が一致しません" });
	let body;
	try {
		body = JSON.parse(raw || "{}");
	} catch (_) {
		return res.status(400).json({ error: "invalid json" });
	}

	if (body.type === "url_verification") return res.status(200).json({ challenge: body.challenge });

	// サーバーレス環境では応答後の処理が打ち切られるため、取り込んでから応答する
	const ev = body.event;
	if (ev && ev.type === "message" && ev.channel && slackProvider.isConfigured()) {
		try {
			const store = getStore();
			const convId = `slack:${ev.channel}`;
			let conversation = await store.getConversation(convId);
			if (!conversation) {
				conversation = await slackProvider.fetchConversation(ev.channel);
				await store.upsertConversations([conversation]);
			}
			const message = await slackProvider.messageFromEvent(conversation, ev);
			if (message) await store.upsertMessages([message]);
		} catch (err) {
			console.error("[webhooks/slack]", err);
		}
	}
	res.status(200).json({ ok: true });
}
