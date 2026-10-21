import { ALL_PROVIDERS, isDemoMode } from "lib/inbox/providers";
import { getStore } from "lib/inbox/store";
import { ensureDemoData } from "lib/inbox/sync";
import { isAuthEnabled, missingPasswordError, methodNotAllowed } from "lib/inbox/auth";

export default async function handler(req, res) {
	if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
	const missing = missingPasswordError();
	if (missing) return res.status(503).json({ error: missing });
	// 認証が有効かどうかはログイン前にも知りたいので、ここでは認証を要求せず最小情報だけ返す
	const authEnabled = isAuthEnabled();
	const authed = !authEnabled || req.headers["x-inbox-token"] === process.env.INBOX_PASSWORD;
	if (!authed) return res.status(200).json({ authEnabled, authed: false });

	const store = getStore();
	const demo = isDemoMode();
	if (demo) await ensureDemoData(store);
	const summary = await store.summary();
	const providers = await Promise.all(
		ALL_PROVIDERS.map(async (p) => {
			const info = { id: p.id, label: p.label, configured: p.isConfigured(), webhookOnly: Boolean(p.webhookOnly), needsLogin: Boolean(p.needsLogin) };
			if (p.needsLogin && info.configured && !demo) {
				try {
					const conn = await p.getConnection();
					info.connected = conn.connected;
					info.user = conn.user ? { name: conn.user.name, email: conn.user.email } : null;
				} catch (err) {
					info.connected = false;
					info.error = err.message;
				}
			}
			return info;
		})
	);
	res.status(200).json({
		authEnabled,
		authed: true,
		demo,
		store: store.kind,
		providers,
		summary,
	});
}

