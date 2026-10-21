import { requestJson } from "./http";
import { getStore } from "./store";
import { encryptJson, decryptJson } from "./secrets";

/**
 * Microsoft アカウント（Microsoft 365 の職場・学校アカウント）への OAuth 2.0 ログインと
 * Microsoft Graph API 呼び出し。
 *
 * 必要な環境変数:
 *   MS_CLIENT_ID      Entra ID（Azure AD）に登録したアプリのクライアント ID
 *   MS_CLIENT_SECRET  クライアントシークレットの「値」
 *   MS_TENANT_ID      任意。既定は "organizations"（マルチテナント）。シングルテナントで登録した場合はテナント ID
 *   MS_REDIRECT_URI   任意。既定はアクセス中のドメイン + /api/auth/microsoft/callback
 *   MS_ENABLE_CHANNELS 任意。"1" でチームのチャンネルも取り込む（管理者の同意が必要）
 */
const ACCOUNT_ID = "teams";
export const STATE_COOKIE = "ms_oauth_state";
const GRAPH = "https://graph.microsoft.com/v1.0";
// 期限切れ直前のトークンは使わず、余裕を持って更新する
const REFRESH_MARGIN_MS = 2 * 60 * 1000;

export class NotConnectedError extends Error {
	constructor(message = "Microsoft でサインインしてください") {
		super(message);
		this.code = "NOT_CONNECTED";
	}
}

export const channelsEnabled = () => process.env.MS_ENABLE_CHANNELS === "1";

const tenant = () => process.env.MS_TENANT_ID || "organizations";
const authority = () => `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0`;

export const scopes = () => {
	const list = ["offline_access", "openid", "profile", "User.Read", "Chat.ReadWrite"];
	if (channelsEnabled()) list.push("Team.ReadBasic.All", "Channel.ReadBasic.All", "ChannelMessage.Read.All", "ChannelMessage.Send");
	return list.join(" ");
};

const requestOrigin = (req) => {
	const proto = (req.headers["x-forwarded-proto"] || "").split(",")[0] || (req.socket?.encrypted ? "https" : "http");
	const host = (req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0];
	return `${proto}://${host}`;
};

export const redirectUri = (req) => process.env.MS_REDIRECT_URI || `${requestOrigin(req)}/api/auth/microsoft/callback`;

export const isSecureRequest = (req) => redirectUri(req).startsWith("https://");

export const buildAuthorizeUrl = (req, state) => {
	const params = new URLSearchParams({
		client_id: process.env.MS_CLIENT_ID,
		response_type: "code",
		response_mode: "query",
		redirect_uri: redirectUri(req),
		scope: scopes(),
		state,
		prompt: "select_account",
	});
	return `${authority()}/authorize?${params}`;
};

const tokenRequest = (form) =>
	requestJson(`${authority()}/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: process.env.MS_CLIENT_ID,
			client_secret: process.env.MS_CLIENT_SECRET,
			scope: scopes(),
			...form,
		}).toString(),
	});

const toAccount = (token, user, previous = {}) => ({
	access_token: token.access_token,
	// 更新時に新しいリフレッシュトークンが返らなければ前のものを使い続ける
	refresh_token: token.refresh_token || previous.refresh_token,
	expires_at: Date.now() + Number(token.expires_in || 3600) * 1000,
	scope: token.scope || previous.scope || "",
	user: user || previous.user,
});

const saveAccount = async (account) => getStore().saveAccountSecret(ACCOUNT_ID, encryptJson(account));

export const getAccount = async () => {
	const secret = await getStore().getAccountSecret(ACCOUNT_ID);
	return secret ? decryptJson(secret) : null;
};

export const disconnect = async () => getStore().deleteAccountSecret(ACCOUNT_ID);

/** 認可コードをトークンに交換し、ログインしたユーザー情報と一緒に保存する */
export const completeLogin = async (req, code) => {
	const token = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri(req) });
	const me = await requestJson(`${GRAPH}/me?$select=id,displayName,mail,userPrincipalName`, {
		headers: { Authorization: `Bearer ${token.access_token}` },
	});
	const user = { id: me.id, name: me.displayName, email: me.mail || me.userPrincipalName || null };
	await saveAccount(toAccount(token, user));
	return user;
};

/** 有効なアクセストークンを返す。期限が近ければリフレッシュトークンで更新する */
export const getAccessToken = async () => {
	const account = await getAccount();
	if (!account?.refresh_token) throw new NotConnectedError();
	if (account.access_token && account.expires_at - REFRESH_MARGIN_MS > Date.now()) return account.access_token;
	try {
		const token = await tokenRequest({ grant_type: "refresh_token", refresh_token: account.refresh_token });
		const next = toAccount(token, null, account);
		await saveAccount(next);
		return next.access_token;
	} catch (err) {
		// 失効・取り消し・パスワード変更などで再ログインが必要な場合
		if (/invalid_grant|interaction_required|AADSTS700082|AADSTS50173/.test(err.message)) {
			await disconnect();
			throw new NotConnectedError("Microsoft のログインが期限切れです。もう一度サインインしてください");
		}
		throw err;
	}
};

export const graph = async (path, options = {}) => {
	const token = await getAccessToken();
	return requestJson(`${GRAPH}${path}`, {
		...options,
		headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) },
	});
};
