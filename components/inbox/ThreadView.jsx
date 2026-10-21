import { useEffect, useRef, useState } from "react";
import { formatTime } from "lib/inbox/format";
import { SERVICES } from "lib/inbox/types";
import { ServiceBadge } from "./ServiceBadge";

const Avatar = ({ message }) => {
	if (message.sender_avatar) {
		// eslint-disable-next-line @next/next/no-img-element
		return <img src={message.sender_avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />;
	}
	const initial = (message.sender_name || "?").trim().charAt(0).toUpperCase();
	return <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-300 text-xs font-bold text-white">{initial}</span>;
};

const Bubble = ({ message }) => {
	const out = message.is_outgoing;
	return (
		<div className={`flex items-end gap-2 ${out ? "flex-row-reverse" : ""}`}>
			{!out && <Avatar message={message} />}
			<div className={`max-w-[75%] ${out ? "items-end" : "items-start"} flex flex-col`}>
				{!out && <span className="mb-0.5 px-1 text-[11px] text-gray-500">{message.sender_name}</span>}
				<div
					className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
						out ? "rounded-br-sm bg-blue-600 text-white" : "rounded-bl-sm bg-white text-gray-900 shadow-sm"
					}`}
				>
					{message.text || <span className="opacity-60">（本文なし）</span>}
				</div>
				<span className="mt-0.5 px-1 text-[10px] text-gray-400">{formatTime(message.sent_at)}</span>
			</div>
		</div>
	);
};

export const ThreadView = ({ thread, onReply, onBack, demo }) => {
	const { conversation, messages } = thread;
	const [text, setText] = useState("");
	const [sending, setSending] = useState(false);
	const [error, setError] = useState(null);
	const bottomRef = useRef(null);
	const textareaRef = useRef(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ block: "end" });
	}, [messages.length, conversation?.id]);

	useEffect(() => {
		setText("");
		setError(null);
		textareaRef.current?.focus();
	}, [conversation?.id]);

	if (!conversation) {
		return (
			<section className="hidden h-full flex-1 items-center justify-center bg-gray-50 text-sm text-gray-400 md:flex">
				左の一覧から会話を選択してください
			</section>
		);
	}

	const send = async () => {
		const value = text.trim();
		if (!value || sending) return;
		setSending(true);
		setError(null);
		try {
			await onReply(value);
			setText("");
		} catch (err) {
			setError(err.message);
		} finally {
			setSending(false);
			textareaRef.current?.focus();
		}
	};

	const onKeyDown = (e) => {
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
			e.preventDefault();
			send();
		}
	};

	const serviceLabel = SERVICES[conversation.service]?.label || conversation.service;

	return (
		<section className="flex h-full flex-1 flex-col bg-gray-50">
			<header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
				<button onClick={onBack} className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 md:hidden" aria-label="戻る">
					←
				</button>
				<ServiceBadge service={conversation.service} size="lg" />
				<div className="min-w-0 flex-1">
					<h2 className="truncate text-base font-bold text-gray-900">{conversation.name}</h2>
					<p className="text-xs text-gray-500">
						{serviceLabel} · {conversation.kind === "dm" ? "ダイレクトメッセージ" : conversation.kind === "group" ? "グループ" : "チャンネル"}
					</p>
				</div>
				{conversation.url && (
					<a
						href={conversation.url}
						target="_blank"
						rel="noreferrer"
						className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
					>
						{serviceLabel} で開く ↗
					</a>
				)}
			</header>

			<div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
				{messages.length === 0 && <p className="py-10 text-center text-sm text-gray-400">メッセージはまだありません</p>}
				{messages.map((m) => (
					<Bubble key={m.id} message={m} />
				))}
				<div ref={bottomRef} />
			</div>

			<footer className="border-t border-gray-200 bg-white px-4 py-3">
				{error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
				<div className="flex items-end gap-2">
					<textarea
						ref={textareaRef}
						value={text}
						onChange={(e) => setText(e.target.value)}
						onKeyDown={onKeyDown}
						rows={2}
						placeholder={`${conversation.name} に返信...（${typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "⌘" : "Ctrl"}+Enter で送信）`}
						className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
					/>
					<button
						onClick={send}
						disabled={sending || !text.trim()}
						className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
					>
						{sending ? "送信中..." : "送信"}
					</button>
				</div>
				<p className="mt-1.5 text-[11px] text-gray-400">
					{demo
						? "デモモード: 外部には送信されません。"
						: conversation.service === "teams"
						? "この返信はあなたの Microsoft アカウントから Teams に送信されます。"
						: `この返信は ${serviceLabel} に連携アカウントから送信されます。`}
				</p>
			</footer>
		</section>
	);
};
