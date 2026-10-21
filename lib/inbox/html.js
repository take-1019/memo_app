/** Teams などの HTML 本文と、プレーンテキストを相互変換する簡易ユーティリティ */

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

const decodeEntities = (text) =>
	text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (match, code) => {
		if (code[0] === "#") {
			const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
			return Number.isFinite(n) ? String.fromCodePoint(n) : match;
		}
		return ENTITIES[code.toLowerCase()] ?? match;
	});

export const htmlToText = (html) => {
	if (!html) return "";
	let text = String(html)
		// 添付ファイルや画像は記号に置き換える
		.replace(/<attachment[^>]*>\s*<\/attachment>/gi, "[添付]")
		.replace(/<img[^>]*>/gi, "[画像]")
		// 絵文字は alt 属性の文字を使う
		.replace(/<emoji[^>]*alt="([^"]*)"[^>]*>(?:\s*<\/emoji>)?/gi, "$1")
		// メンションは @ を付ける
		.replace(/<at[^>]*>(.*?)<\/at>/gi, "@$1")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
		.replace(/<li[^>]*>/gi, "・")
		.replace(/<[^>]+>/g, "");
	text = decodeEntities(text);
	return text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
};

const escapeHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 改行を保ったまま HTML 本文にする */
export const textToHtml = (text) => escapeHtml(String(text)).replace(/\r?\n/g, "<br>");
