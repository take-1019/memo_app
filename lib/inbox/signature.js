import crypto from "crypto";

/** 長さが違っても例外を投げない定数時間比較 */
export const safeEqual = (a, b) => {
	const x = Buffer.from(String(a || ""));
	const y = Buffer.from(String(b || ""));
	if (x.length !== y.length) return false;
	return crypto.timingSafeEqual(x, y);
};

/** 署名用シークレットが未設定のとき、開発環境だけ検証を省略する */
export const allowUnsigned = () => process.env.NODE_ENV !== "production";

export const readRawBody = (req) =>
	new Promise((resolve, reject) => {
		const chunks = [];
		req.on("data", (c) => chunks.push(c));
		req.on("end", () => resolve(Buffer.concat(chunks)));
		req.on("error", reject);
	});
