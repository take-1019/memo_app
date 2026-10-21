import crypto from "crypto";
import { requireAuth, methodNotAllowed } from "lib/inbox/auth";
import { buildAuthorizeUrl, isSecureRequest, STATE_COOKIE } from "lib/inbox/microsoft";
import { isServiceConfigured } from "lib/inbox/config";

/**
 * POST /api/auth/microsoft/start
 * Microsoft のサインイン画面の URL を返す。
 * 受信箱のパスワードを知っている人だけが始められるよう、ここで認証し、
 * 推測できない state を Cookie に入れてコールバックで照合する（CSRF 対策）。
 */
export default async function handler(req, res) {
	if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
	if (!requireAuth(req, res)) return;
	if (!isServiceConfigured("teams")) {
		return res.status(400).json({ error: "MS_CLIENT_ID と MS_CLIENT_SECRET を設定してください" });
	}
	const state = crypto.randomBytes(24).toString("base64url");
	const cookie = [
		`${STATE_COOKIE}=${state}`,
		"Path=/api/auth/microsoft",
		"HttpOnly",
		"SameSite=Lax",
		"Max-Age=600",
		isSecureRequest(req) ? "Secure" : null,
	]
		.filter(Boolean)
		.join("; ");
	res.setHeader("Set-Cookie", cookie);
	res.status(200).json({ url: buildAuthorizeUrl(req, state) });
}
