/**
 * 各サービスが「環境変数として設定済みか」を判定する。
 * 他のモジュール（保存層・認証・各プロバイダ）から循環せずに使えるよう、依存を持たない。
 */
export const SERVICE_CONFIG = {
	slack: () => Boolean(process.env.SLACK_BOT_TOKEN),
	chatwork: () => Boolean(process.env.CHATWORK_API_TOKEN),
	line: () => Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
	discord: () => Boolean(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_GUILD_ID),
	teams: () => Boolean(process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET),
};

export const isServiceConfigured = (service) => Boolean(SERVICE_CONFIG[service]?.());

/** どのサービスも設定されていなければデモモード */
export const isDemoMode = () => !Object.values(SERVICE_CONFIG).some((check) => check());
