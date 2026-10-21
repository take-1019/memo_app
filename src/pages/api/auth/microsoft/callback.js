import { completeLogin, STATE_COOKIE } from "lib/inbox/microsoft";
import { safeEqual } from "lib/inbox/signature";

/**
 * GET /api/auth/microsoft/callback
 * Microsoft のサインイン後に戻ってくる先。state を照合し、トークンを保存して受信箱に戻す。
 */
const back = (res, params) => res.redirect(302, `/?${new URLSearchParams(params)}`);

export default async function handler(req, res) {
	const { code, state, error, error_description: errorDescription } = req.query;
	const expected = req.cookies?.[STATE_COOKIE];
	res.setHeader("Set-Cookie", `${STATE_COOKIE}=; Path=/api/auth/microsoft; HttpOnly; SameSite=Lax; Max-Age=0`);

	if (error) {
		const reason = String(errorDescription || error).split("\n")[0].slice(0, 300);
		return back(res, { teams_error: `サインインできませんでした: ${reason}` });
	}
	if (!code || !state || !expected || !safeEqual(state, expected)) {
		return back(res, { teams_error: "サインインの有効期限が切れたか、不正なリクエストです。もう一度お試しください" });
	}
	try {
		const user = await completeLogin(req, String(code));
		return back(res, { teams: "connected", teams_user: user.name || user.email || "" });
	} catch (err) {
		console.error("[auth/microsoft/callback]", err);
		const hint = /AADSTS50020|AADSTS500200|personal Microsoft account/i.test(err.message)
			? "個人用 Microsoft アカウントは使えません。職場または学校のアカウントでサインインしてください"
			: err.message.slice(0, 300);
		return back(res, { teams_error: `サインインに失敗しました: ${hint}` });
	}
}
