import { formatRelative } from "lib/inbox/format";
import { ServiceBadge } from "./ServiceBadge";

export const ConversationList = ({ conversations, selectedId, onSelect, filter, setFilter }) => {
	return (
		<section className="flex h-full w-full flex-col border-r border-gray-200 bg-gray-50 md:w-80 lg:w-96">
			<div className="border-b border-gray-200 bg-white px-3 py-3">
				<input
					type="search"
					value={filter.q}
					onChange={(e) => setFilter({ ...filter, q: e.target.value })}
					placeholder="名前・本文で検索"
					className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
				/>
			</div>
			<ul className="flex-1 overflow-y-auto">
				{conversations.length === 0 && <li className="px-4 py-10 text-center text-sm text-gray-400">会話がありません</li>}
				{conversations.map((c) => {
					const active = c.id === selectedId;
					const unread = c.unread_count > 0;
					return (
						<li key={c.id}>
							<button
								onClick={() => onSelect(c.id)}
								className={`flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3 text-left transition ${
									active ? "bg-blue-50" : "hover:bg-white"
								}`}
							>
								<ServiceBadge service={c.service} size="lg" />
								<div className="min-w-0 flex-1">
									<div className="flex items-baseline justify-between gap-2">
										<p className={`truncate text-sm ${unread ? "font-bold text-gray-900" : "font-medium text-gray-800"}`}>{c.name}</p>
										<span className="shrink-0 text-[11px] text-gray-400">{formatRelative(c.last_message_at)}</span>
									</div>
									<div className="mt-0.5 flex items-center justify-between gap-2">
										<p className={`truncate text-xs ${unread ? "text-gray-800" : "text-gray-500"}`}>
											{c.last_sender ? <span className="text-gray-400">{c.last_sender}: </span> : null}
											{c.last_message_text || "（メッセージなし）"}
										</p>
										{unread && (
											<span className="shrink-0 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
												{c.unread_count}
											</span>
										)}
									</div>
								</div>
							</button>
						</li>
					);
				})}
			</ul>
		</section>
	);
};
