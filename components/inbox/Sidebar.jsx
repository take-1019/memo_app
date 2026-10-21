import { SERVICES } from "lib/inbox/types";
import { ServiceBadge } from "./ServiceBadge";

export const Sidebar = ({ status, filter, setFilter, onSync, syncing, lastSyncedAt, onConnectTeams, onDisconnectTeams }) => {
	const summary = status?.summary || {};
	const totalUnread = Object.values(summary).reduce((n, s) => n + s.unread, 0);
	const totalAll = Object.values(summary).reduce((n, s) => n + s.total, 0);
	const providers = status?.providers || [];
	const teams = providers.find((p) => p.id === "teams");
	const showTeamsAccount = !status?.demo && teams?.configured;

	const Item = ({ active, onClick, children, count }) => (
		<button
			onClick={onClick}
			className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
				active ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
			}`}
		>
			<span className="flex items-center gap-2 truncate">{children}</span>
			{count > 0 && (
				<span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${active ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"}`}>
					{count}
				</span>
			)}
		</button>
	);

	return (
		<aside className="flex h-full w-full flex-col border-r border-gray-200 bg-white md:w-60">
			<div className="border-b border-gray-200 px-4 py-4">
				<h1 className="text-lg font-bold text-gray-900">統合チャット受信箱</h1>
				<p className="mt-0.5 text-xs text-gray-500">すべてのチャットを一箇所で確認・返信</p>
			</div>

			<nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
				<div className="space-y-1">
					<Item active={!filter.service && !filter.unreadOnly} onClick={() => setFilter({ ...filter, service: null, unreadOnly: false })} count={totalAll}>
						📥 すべて
					</Item>
					<Item active={filter.unreadOnly && !filter.service} onClick={() => setFilter({ ...filter, service: null, unreadOnly: true })} count={totalUnread}>
						🔵 未読
					</Item>
				</div>

				<div>
					<p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">サービス</p>
					<div className="space-y-1">
						{Object.values(SERVICES)
							.filter((s) => s.id !== "demo")
							.map((s) => {
								const p = providers.find((x) => x.id === s.id);
								const configured = status?.demo || p?.configured;
								return (
									<Item
										key={s.id}
										active={filter.service === s.id}
										onClick={() => setFilter({ ...filter, service: s.id, unreadOnly: false })}
										count={summary[s.id]?.unread || 0}
									>
										<ServiceBadge service={s.id} />
										<span className={configured ? "" : "text-gray-400"}>{s.label}</span>
										{!configured && <span className="text-[10px] text-gray-400">未設定</span>}
										{configured && p?.needsLogin && !status?.demo && !p.connected && <span className="text-[10px] text-amber-600">未接続</span>}
									</Item>
								);
							})}
					</div>
				</div>
				{showTeamsAccount && (
					<div className="rounded-lg border border-gray-200 px-3 py-2.5 text-xs">
						<p className="mb-1.5 flex items-center gap-1.5 font-semibold text-gray-700">
							<ServiceBadge service="teams" /> Teams アカウント
						</p>
						{teams.connected ? (
							<>
								<p className="truncate text-gray-600" title={teams.user?.email || ""}>
									{teams.user?.name || teams.user?.email || "接続中"}
								</p>
								<button onClick={onDisconnectTeams} className="mt-1.5 text-gray-400 underline hover:text-gray-600">
									接続を解除
								</button>
							</>
						) : (
							<>
								{teams.error && <p className="mb-1.5 text-red-600">{teams.error}</p>}
								<button onClick={onConnectTeams} className="w-full rounded-md bg-[#5B5FC7] px-2 py-1.5 font-semibold text-white hover:opacity-90">
									Microsoft でサインイン
								</button>
							</>
						)}
					</div>
				)}
			</nav>

			<div className="border-t border-gray-200 px-4 py-3 text-xs text-gray-500">
				<button
					onClick={onSync}
					disabled={syncing}
					className="mb-2 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
				>
					{syncing ? "同期中..." : "🔄 今すぐ同期"}
				</button>
				<div className="flex items-center justify-between">
					<span>{lastSyncedAt ? `最終同期 ${new Date(lastSyncedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}` : "未同期"}</span>
					<span className="rounded bg-gray-100 px-1.5 py-0.5">{status?.store === "supabase" ? "Supabase" : "メモリ"}</span>
				</div>
			</div>
		</aside>
	);
};
