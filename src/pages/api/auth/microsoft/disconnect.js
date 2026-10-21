import { requireAuth, methodNotAllowed } from "lib/inbox/auth";
import { disconnect } from "lib/inbox/microsoft";

/** POST /api/auth/microsoft/disconnect  保存している Microsoft のログイン情報を削除する */
export default async function handler(req, res) {
	if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
	if (!requireAuth(req, res)) return;
	await disconnect();
	res.status(200).json({ ok: true });
}
