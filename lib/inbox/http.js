/**
 * 外部 API 呼び出しの共通ヘルパー。
 * JSON を返し、HTTP エラーは例外にする。
 */
export const requestJson = async (url, options = {}) => {
	const res = await fetch(url, options);
	const text = await res.text();
	let body = null;
	try {
		body = text ? JSON.parse(text) : null;
	} catch (_) {
		body = text;
	}
	if (!res.ok) {
		const detail = typeof body === "string" ? body : JSON.stringify(body);
		throw new Error(`${options.method || "GET"} ${url} -> ${res.status}: ${detail}`);
	}
	return body;
};

export const toIso = (value) => {
	if (value === undefined || value === null) return new Date().toISOString();
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "number") {
		// 秒 or ミリ秒を判定
		return new Date(value < 1e12 ? value * 1000 : value).toISOString();
	}
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};
