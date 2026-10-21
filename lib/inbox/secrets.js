import crypto from "crypto";

/**
 * ログイン情報（リフレッシュトークン等）を DB に保存する前に AES-256-GCM で暗号化する。
 * 鍵は INBOX_ENCRYPTION_KEY、なければ MS_CLIENT_SECRET から作る。
 * 鍵が変わると復号できなくなるので、その場合は再ログインが必要になる。
 */
const getKey = () => {
	const material = process.env.INBOX_ENCRYPTION_KEY || process.env.MS_CLIENT_SECRET;
	if (!material) throw new Error("暗号化キーがありません（INBOX_ENCRYPTION_KEY または MS_CLIENT_SECRET を設定してください）");
	return crypto.createHash("sha256").update(`unified-inbox:${material}`).digest();
};

export const encryptJson = (value) => {
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
	const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
	return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(".");
};

/** 復号できなければ null を返す（鍵の変更・改ざん時） */
export const decryptJson = (payload) => {
	try {
		const [version, iv, tag, data] = String(payload).split(".");
		if (version !== "v1") return null;
		const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
		decipher.setAuthTag(Buffer.from(tag, "base64"));
		const text = Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
		return JSON.parse(text);
	} catch (_) {
		return null;
	}
};
