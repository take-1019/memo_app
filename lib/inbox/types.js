/**
 * 各チャットサービスのデータを正規化した共通スキーマ。
 *
 * @typedef {"slack" | "chatwork" | "line" | "discord" | "teams" | "demo"} ServiceId
 *
 * @typedef {Object} Conversation
 * @property {string} id                 `${service}:${external_id}`
 * @property {ServiceId} service
 * @property {string} external_id        サービス側のチャンネル/ルーム/ユーザー ID
 * @property {string} name               表示名
 * @property {"channel" | "dm" | "group"} kind
 * @property {string | null} url         サービス本体で開くリンク
 * @property {string | null} last_message_at ISO 日時
 * @property {string | null} last_message_text
 * @property {string | null} last_sender
 * @property {number} unread_count
 * @property {string | null} last_read_at
 * @property {Object} meta               サービス固有の情報（返信に必要な ID など）
 *
 * @typedef {Object} Message
 * @property {string} id                 `${service}:${external_id}`
 * @property {string} conversation_id
 * @property {ServiceId} service
 * @property {string} external_id
 * @property {string | null} sender_id
 * @property {string} sender_name
 * @property {string | null} sender_avatar
 * @property {string} text
 * @property {string} sent_at            ISO 日時
 * @property {boolean} is_outgoing       自分（ボット/連携アカウント）からの送信か
 * @property {Object} meta
 */

export const SERVICES = {
	slack: { id: "slack", label: "Slack", color: "#4A154B" },
	chatwork: { id: "chatwork", label: "Chatwork", color: "#F15D22" },
	line: { id: "line", label: "LINE", color: "#06C755" },
	discord: { id: "discord", label: "Discord", color: "#5865F2" },
	teams: { id: "teams", label: "Teams", color: "#5B5FC7" },
	demo: { id: "demo", label: "Demo", color: "#6B7280" },
};

export const conversationId = (service, externalId) => `${service}:${externalId}`;
export const messageId = (service, externalId) => `${service}:${externalId}`;
