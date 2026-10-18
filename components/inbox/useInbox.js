import { useCallback, useEffect, useRef, useState } from "react";

const TOKEN_KEY = "inbox_token";
export const getToken = () => (typeof window === "undefined" ? "" : window.localStorage.getItem(TOKEN_KEY) || "");
export const setToken = (t) => window.localStorage.setItem(TOKEN_KEY, t);

export const api = async (path, { method = "GET", body } = {}) => {
	const res = await fetch(path, {
		method,
		headers: { "Content-Type": "application/json", "x-inbox-token": getToken() },
		body: body ? JSON.stringify(body) : undefined,
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw Object.assign(new Error(data.error || `${res.status}`), { status: res.status });
	return data;
};

const POLL_MS = 15000;
const SYNC_MS = 60000;

/**
 * 受信箱の状態管理。会話一覧・選択中スレッド・フィルタ・同期を扱う。
 */
export const useInbox = () => {
	const [status, setStatus] = useState(null);
	const [conversations, setConversations] = useState([]);
	const [filter, setFilter] = useState({ service: null, unreadOnly: false, q: "" });
	const [selectedId, setSelectedId] = useState(null);
	const [thread, setThread] = useState({ conversation: null, messages: [] });
	const [syncing, setSyncing] = useState(false);
	const [error, setError] = useState(null);
	const [lastSyncedAt, setLastSyncedAt] = useState(null);
	const filterRef = useRef(filter);
	filterRef.current = filter;

	const loadStatus = useCallback(async () => {
		const s = await api("/api/inbox/status");
		setStatus(s);
		return s;
	}, []);

	const loadConversations = useCallback(async () => {
		const f = filterRef.current;
		const params = new URLSearchParams();
		if (f.service) params.set("service", f.service);
		if (f.unreadOnly) params.set("unread", "1");
		if (f.q) params.set("q", f.q);
		const data = await api(`/api/inbox/conversations?${params}`);
		setConversations(data.conversations);
	}, []);

	/** スレッドを読み込み、未読があれば既読にする */
	const loadThread = useCallback(async (id) => {
		if (!id) return;
		const data = await api(`/api/inbox/messages?conversationId=${encodeURIComponent(id)}`);
		setThread(data);
		if (data.conversation?.unread_count > 0) {
			await api("/api/inbox/read", { method: "POST", body: { conversationId: id } });
			setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)));
		}
	}, []);

	const refresh = useCallback(async () => {
		try {
			await Promise.all([loadStatus(), loadConversations(), selectedId ? loadThread(selectedId) : null]);
			setError(null);
		} catch (err) {
			setError(err.message);
		}
	}, [loadStatus, loadConversations, loadThread, selectedId]);

	const sync = useCallback(async () => {
		setSyncing(true);
		try {
			const data = await api("/api/inbox/sync", { method: "POST" });
			setLastSyncedAt(data.syncedAt);
			await refresh();
		} catch (err) {
			setError(err.message);
		} finally {
			setSyncing(false);
		}
	}, [refresh]);

	const select = useCallback(
		async (id) => {
			setSelectedId(id);
			try {
				await loadThread(id);
				loadStatus().catch(() => {});
			} catch (err) {
				setError(err.message);
			}
		},
		[loadThread, loadStatus]
	);

	const reply = useCallback(
		async (text, options = {}) => {
			if (!selectedId) return;
			const data = await api("/api/inbox/reply", { method: "POST", body: { conversationId: selectedId, text, ...options } });
			setThread((prev) => ({ ...prev, messages: [...prev.messages, data.message] }));
			loadConversations().catch(() => {});
			return data.message;
		},
		[selectedId, loadConversations]
	);

	// 初回: 同期してから読み込み
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const s = await loadStatus();
				if (cancelled || s.authed === false) return;
				await sync();
			} catch (err) {
				if (!cancelled) setError(err.message);
			}
		})();
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// フィルタ変更時に一覧を再取得
	useEffect(() => {
		if (!status?.authed) return;
		loadConversations().catch((err) => setError(err.message));
	}, [filter, status?.authed, loadConversations]);

	// 定期ポーリング（一覧・スレッド）と定期同期
	useEffect(() => {
		if (!status?.authed) return;
		const poll = setInterval(() => refresh(), POLL_MS);
		const syncTimer = setInterval(() => sync(), SYNC_MS);
		return () => {
			clearInterval(poll);
			clearInterval(syncTimer);
		};
	}, [status?.authed, refresh, sync]);

	return {
		status,
		conversations,
		filter,
		setFilter,
		selectedId,
		select,
		thread,
		reply,
		sync,
		syncing,
		error,
		lastSyncedAt,
		reloadStatus: loadStatus,
		clearSelection: () => setSelectedId(null),
	};
};
