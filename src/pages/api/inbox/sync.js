import { syncAll } from "lib/inbox/sync";
import { requireAuth, methodNotAllowed } from "lib/inbox/auth";

/**
 * POST /api/inbox/sync
 * 設定済みの全サービスから最新の会話とメッセージを取り込む。
 * Vercel Cron 等から定期実行する場合は、`x-inbox-token` ヘッダーに INBOX_PASSWORD を付ける。
 */
export default async function handler(req, res) {
	if (req.method !== "POST" && req.method !== "GET") return methodNotAllowed(res, ["GET", "POST"]);
	if (!requireAuth(req, res)) return;
	try {
		const results = await syncAll();
		res.status(200).json({ ok: true, results, syncedAt: new Date().toISOString() });
	} catch (err) {
		console.error("[inbox/sync]", err);
		res.status(500).json({ ok: false, error: err.message });
	}
}
