import Head from "next/head";
import { Sidebar } from "components/inbox/Sidebar";
import { ConversationList } from "components/inbox/ConversationList";
import { ThreadView } from "components/inbox/ThreadView";
import { LoginGate } from "components/inbox/LoginGate";
import { useInbox } from "components/inbox/useInbox";

const Home = () => {
	const inbox = useInbox();
	const { status, error } = inbox;

	if (status && status.authEnabled && !status.authed) {
		return (
			<LoginGate
				onLogin={async () => {
					const s = await inbox.reloadStatus();
					if (s.authed) inbox.sync();
					return s.authed;
				}}
			/>
		);
	}

	const showThread = Boolean(inbox.selectedId);

	return (
		<>
			<Head>
				<title>統合チャット受信箱</title>
				<meta name="viewport" content="width=device-width, initial-scale=1" />
			</Head>
			<div className="flex h-screen flex-col bg-gray-50 text-gray-900">
				{status?.demo && (
					<div className="bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900">
						デモモードで動作しています。<code className="rounded bg-amber-200 px-1">.env</code> に各サービスのトークンを設定すると実際のチャットが取り込まれます（README 参照）。
					</div>
				)}
				{error && <div className="bg-red-100 px-4 py-1.5 text-center text-xs text-red-800">{error}</div>}
				<div className="flex min-h-0 flex-1">
					<div className={`${showThread ? "hidden" : "flex"} w-full md:flex md:w-auto`}>
						<div className="hidden md:block">
							<Sidebar
								status={status}
								filter={inbox.filter}
								setFilter={inbox.setFilter}
								onSync={inbox.sync}
								syncing={inbox.syncing}
								lastSyncedAt={inbox.lastSyncedAt}
							/>
						</div>
						<ConversationList
							conversations={inbox.conversations}
							selectedId={inbox.selectedId}
							onSelect={inbox.select}
							filter={inbox.filter}
							setFilter={inbox.setFilter}
						/>
					</div>
					<div className={`${showThread ? "flex" : "hidden"} min-w-0 flex-1 md:flex`}>
						<ThreadView thread={inbox.thread} onReply={inbox.reply} onBack={inbox.clearSelection} demo={status?.demo} />
					</div>
				</div>
				{/* モバイル用のサービス切替 */}
				{!showThread && (
					<div className="flex gap-1 overflow-x-auto border-t border-gray-200 bg-white px-2 py-2 md:hidden">
						{[
							{ id: null, label: "すべて" },
							{ id: "slack", label: "Slack" },
							{ id: "chatwork", label: "Chatwork" },
							{ id: "line", label: "LINE" },
							{ id: "discord", label: "Discord" },
						].map((s) => (
							<button
								key={s.label}
								onClick={() => inbox.setFilter({ ...inbox.filter, service: s.id, unreadOnly: false })}
								className={`shrink-0 rounded-full px-3 py-1 text-xs ${
									inbox.filter.service === s.id && !inbox.filter.unreadOnly ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
								}`}
							>
								{s.label}
							</button>
						))}
						<button
							onClick={() => inbox.setFilter({ ...inbox.filter, service: null, unreadOnly: true })}
							className={`shrink-0 rounded-full px-3 py-1 text-xs ${inbox.filter.unreadOnly ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}
						>
							未読
						</button>
						<button onClick={inbox.sync} className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
							🔄
						</button>
					</div>
				)}
			</div>
		</>
	);
};

export default Home;
