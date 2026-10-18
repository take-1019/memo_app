import { ALL_PROVIDERS, isDemoMode } from "lib/inbox/providers";
import { getStore } from "lib/inbox/store";
import { ensureDemoData } from "lib/inbox/sync";
import { isAuthEnabled, requireAuth, methodNotAllowed } from "lib/inbox/auth";

export default async function handler(req, res) {
	if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
	// 認証が有効かどうかはログイン前にも知りたいので、ここでは認証を要求せず最小情報だけ返す
	const authEnabled = isAuthEnabled();
	const authed = !authEnabled || req.headers["x-inbox-token"] === process.env.INBOX_PASSWORD;
	if (!authed) return res.status(200).json({ authEnabled, authed: false });

	const store = getStore();
	const demo = isDemoMode();
	if (demo) await ensureDemoData(store);
	const summary = await store.summary();
	res.status(200).json({
		authEnabled,
		authed: true,
		demo,
		store: store.kind,
		providers: ALL_PROVIDERS.map((p) => ({ id: p.id, label: p.label, configured: p.isConfigured(), webhookOnly: Boolean(p.webhookOnly) })),
		summary,
	});
}

