/** 相対時刻の表示（クライアント・サーバー両方で使える） */
export const formatRelative = (iso) => {
	if (!iso) return "";
	const diff = Date.now() - new Date(iso).getTime();
	const min = Math.floor(diff / 60000);
	if (min < 1) return "今";
	if (min < 60) return `${min}分前`;
	const hour = Math.floor(min / 60);
	if (hour < 24) return `${hour}時間前`;
	const day = Math.floor(hour / 24);
	if (day < 7) return `${day}日前`;
	const d = new Date(iso);
	return `${d.getMonth() + 1}/${d.getDate()}`;
};

export const formatTime = (iso) => {
	if (!iso) return "";
	const d = new Date(iso);
	const pad = (n) => String(n).padStart(2, "0");
	return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
