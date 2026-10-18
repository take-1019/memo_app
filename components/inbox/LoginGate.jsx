import { useState } from "react";
import { setToken } from "./useInbox";

export const LoginGate = ({ onLogin }) => {
	const [value, setValue] = useState("");
	const [error, setError] = useState(null);

	const submit = async (e) => {
		e.preventDefault();
		setToken(value);
		const ok = await onLogin();
		if (!ok) setError("パスワードが違います");
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
			<form onSubmit={submit} className="w-full max-w-sm rounded-xl bg-white p-6 shadow">
				<h1 className="text-lg font-bold text-gray-900">統合チャット受信箱</h1>
				<p className="mt-1 text-sm text-gray-500">アクセスパスワードを入力してください</p>
				<input
					type="password"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					className="mt-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
					autoFocus
				/>
				{error && <p className="mt-2 text-xs text-red-600">{error}</p>}
				<button type="submit" className="mt-4 w-full rounded-md bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700">
					ログイン
				</button>
			</form>
		</div>
	);
};
