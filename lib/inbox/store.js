import { createClient } from "@supabase/supabase-js";

/**
 * 会話・メッセージの保存層。
 * - Supabase の環境変数（NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY）があれば Supabase を使う
 * - なければプロセス内メモリ（開発・デモ用）にフォールバックする
 *
 * どちらも同じインターフェースを持つ。
 */

const sortByLatest = (a, b) => (b.last_message_at || "").localeCompare(a.last_message_at || "");
const sortByTime = (a, b) => a.sent_at.localeCompare(b.sent_at);

const applyFilters = (conversations, { service, unreadOnly, q } = {}) => {
	let list = conversations;
	if (service) list = list.filter((c) => c.service === service);
	if (unreadOnly) list = list.filter((c) => (c.unread_count || 0) > 0);
	if (q) {
		const needle = q.toLowerCase();
		list = list.filter((c) => (c.name || "").toLowerCase().includes(needle) || (c.last_message_text || "").toLowerCase().includes(needle));
	}
	return list;
};

// ---------------------------------------------------------------- memory store
const createMemoryStore = () => {
	// Next.js の API ルートはルート毎に別バンドルになるため globalThis で共有する
	const g = globalThis;
	if (!g.__inboxMemory) {
		g.__inboxMemory = { conversations: new Map(), messages: new Map(), seeded: false };
	}
	const db = g.__inboxMemory;

	return {
		kind: "memory",
		get seeded() {
			return db.seeded;
		},
		set seeded(v) {
			db.seeded = v;
		},

		async upsertConversations(conversations) {
			for (const conv of conversations) {
				const prev = db.conversations.get(conv.id);
				db.conversations.set(conv.id, {
					unread_count: 0,
					last_read_at: null,
					...prev,
					...conv,
					// 既存の既読状態や未読数は保持する
					unread_count: prev ? prev.unread_count : conv.unread_count || 0,
					last_read_at: prev ? prev.last_read_at : conv.last_read_at || null,
				});
			}
		},

		/** 新規メッセージだけを返し、会話の最終メッセージと未読数を更新する */
		async upsertMessages(messages) {
			const inserted = [];
			for (const msg of messages) {
				const isNew = !db.messages.has(msg.id);
				db.messages.set(msg.id, { ...db.messages.get(msg.id), ...msg });
				if (isNew) inserted.push(msg);
			}
			const byConv = new Map();
			for (const msg of inserted) {
				if (!byConv.has(msg.conversation_id)) byConv.set(msg.conversation_id, []);
				byConv.get(msg.conversation_id).push(msg);
			}
			for (const [convId, msgs] of byConv) {
				const conv = db.conversations.get(convId);
				if (!conv) continue;
				const latest = msgs.slice().sort(sortByTime).at(-1);
				if (!conv.last_message_at || latest.sent_at > conv.last_message_at) {
					conv.last_message_at = latest.sent_at;
					conv.last_message_text = latest.text;
					conv.last_sender = latest.sender_name;
				}
				const unreadDelta = msgs.filter((m) => !m.is_outgoing && (!conv.last_read_at || m.sent_at > conv.last_read_at)).length;
				conv.unread_count = (conv.unread_count || 0) + unreadDelta;
			}
			return inserted;
		},

		async listConversations(filters) {
			return applyFilters([...db.conversations.values()], filters).sort(sortByLatest);
		},

		async getConversation(id) {
			return db.conversations.get(id) || null;
		},

		async listMessages(conversationId, { limit = 200 } = {}) {
			return [...db.messages.values()]
				.filter((m) => m.conversation_id === conversationId)
				.sort(sortByTime)
				.slice(-limit);
		},

		async markRead(conversationId) {
			const conv = db.conversations.get(conversationId);
			if (!conv) return null;
			conv.unread_count = 0;
			conv.last_read_at = new Date().toISOString();
			return conv;
		},

		async summary() {
			const counts = {};
			for (const conv of db.conversations.values()) {
				counts[conv.service] = counts[conv.service] || { total: 0, unread: 0 };
				counts[conv.service].total += 1;
				counts[conv.service].unread += conv.unread_count || 0;
			}
			return counts;
		},
	};
};

// -------------------------------------------------------------- supabase store
const createSupabaseStore = (url, key) => {
	const supabase = createClient(url, key);
	const CONV = "inbox_conversations";
	const MSG = "inbox_messages";

	const unwrap = ({ data, error }) => {
		if (error) {
			const hint = error.code === "42P01" ? "（supabase/schema.sql を Supabase の SQL Editor で実行してテーブルを作成してください）" : "";
			throw new Error(`Supabase: ${error.message}${hint}`);
		}
		return data;
	};

	return {
		kind: "supabase",
		seeded: false,

		async upsertConversations(conversations) {
			if (conversations.length === 0) return;
			const ids = conversations.map((c) => c.id);
			const existing = unwrap(await supabase.from(CONV).select("id, unread_count, last_read_at").in("id", ids));
			const existingMap = new Map((existing || []).map((c) => [c.id, c]));
			const rows = conversations.map((c) => {
				const prev = existingMap.get(c.id);
				return {
					...c,
					unread_count: prev ? prev.unread_count : c.unread_count || 0,
					last_read_at: prev ? prev.last_read_at : c.last_read_at || null,
				};
			});
			unwrap(await supabase.from(CONV).upsert(rows, { onConflict: "id", returning: "minimal" }));
		},

		async upsertMessages(messages) {
			if (messages.length === 0) return [];
			const ids = messages.map((m) => m.id);
			const existing = unwrap(await supabase.from(MSG).select("id").in("id", ids));
			const existingIds = new Set((existing || []).map((m) => m.id));
			const inserted = messages.filter((m) => !existingIds.has(m.id));
			unwrap(await supabase.from(MSG).upsert(messages, { onConflict: "id", returning: "minimal" }));

			const byConv = new Map();
			for (const msg of inserted) {
				if (!byConv.has(msg.conversation_id)) byConv.set(msg.conversation_id, []);
				byConv.get(msg.conversation_id).push(msg);
			}
			for (const [convId, msgs] of byConv) {
				const conv = unwrap(await supabase.from(CONV).select("*").eq("id", convId).maybeSingle());
				if (!conv) continue;
				const latest = msgs.slice().sort(sortByTime).at(-1);
				const patch = {};
				if (!conv.last_message_at || latest.sent_at > conv.last_message_at) {
					patch.last_message_at = latest.sent_at;
					patch.last_message_text = latest.text;
					patch.last_sender = latest.sender_name;
				}
				const unreadDelta = msgs.filter((m) => !m.is_outgoing && (!conv.last_read_at || m.sent_at > conv.last_read_at)).length;
				patch.unread_count = (conv.unread_count || 0) + unreadDelta;
				unwrap(await supabase.from(CONV).update(patch, { returning: "minimal" }).eq("id", convId));
			}
			return inserted;
		},

		async listConversations(filters = {}) {
			let query = supabase.from(CONV).select("*").order("last_message_at", { ascending: false, nullsFirst: false });
			if (filters.service) query = query.eq("service", filters.service);
			if (filters.unreadOnly) query = query.gt("unread_count", 0);
			const data = unwrap(await query);
			return applyFilters(data || [], { q: filters.q });
		},

		async getConversation(id) {
			return unwrap(await supabase.from(CONV).select("*").eq("id", id).maybeSingle());
		},

		async listMessages(conversationId, { limit = 200 } = {}) {
			const data = unwrap(
				await supabase.from(MSG).select("*").eq("conversation_id", conversationId).order("sent_at", { ascending: false }).limit(limit)
			);
			return (data || []).reverse();
		},

		async markRead(conversationId) {
			const data = unwrap(
				await supabase.from(CONV).update({ unread_count: 0, last_read_at: new Date().toISOString() }).eq("id", conversationId)
			);
			return data?.[0] || null;
		},

		async summary() {
			const data = unwrap(await supabase.from(CONV).select("service, unread_count"));
			const counts = {};
			for (const conv of data || []) {
				counts[conv.service] = counts[conv.service] || { total: 0, unread: 0 };
				counts[conv.service].total += 1;
				counts[conv.service].unread += conv.unread_count || 0;
			}
			return counts;
		},
	};
};

let cached = null;
export const getStore = () => {
	if (cached) return cached;
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
	cached = url && key && !process.env.INBOX_FORCE_MEMORY_STORE ? createSupabaseStore(url, key) : createMemoryStore();
	return cached;
};
