/**
 * 簡易アクセス制限。
 * INBOX_PASSWORD を設定すると、API 呼び出しに `x-inbox-token` ヘッダー（同じ値）が必要になる。
 * 未設定なら誰でもアクセス可（ローカル開発用）。公開環境では必ず設定すること。
 */
import { isDemoMode } from "./config";

export const isAuthEnabled = () => Boolean(process.env.INBOX_PASSWORD);

/** 本番で実際のチャットをつないでいるのにパスワードが無い状態は危険なので止める */
export const missingPasswordError = () =>
	!isAuthEnabled() && process.env.NODE_ENV === "production" && !isDemoMode()
		? "INBOX_PASSWORD が未設定です。チャットを公開しないよう、環境変数 INBOX_PASSWORD を設定してから再デプロイしてください。"
		: null;

export const requireAuth = (req, res) => {
	const missing = missingPasswordError();
	if (missing) {
		res.status(503).json({ error: missing });
		return false;
	}
	if (!isAuthEnabled()) return true;
	const token = req.headers["x-inbox-token"];
	if (token && token === process.env.INBOX_PASSWORD) return true;
	// Vercel Cron からの呼び出し（Authorization: Bearer <CRON_SECRET>）も許可する
	const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
	if (process.env.CRON_SECRET && bearer === process.env.CRON_SECRET) return true;
	res.status(401).json({ error: "認証が必要です" });
	return false;
};

export const methodNotAllowed = (res, allowed) => {
	res.setHeader("Allow", allowed.join(", "));
	res.status(405).json({ error: "Method Not Allowed" });
};
