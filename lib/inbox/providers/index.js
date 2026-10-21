import { slackProvider } from "./slack";
import { chatworkProvider } from "./chatwork";
import { lineProvider } from "./line";
import { discordProvider } from "./discord";
import { teamsProvider } from "./teams";
import { demoProvider } from "./demo";
import { isDemoMode } from "../config";

export const ALL_PROVIDERS = [slackProvider, chatworkProvider, lineProvider, discordProvider, teamsProvider];

export const getConfiguredProviders = () => ALL_PROVIDERS.filter((p) => p.isConfigured());

export { isDemoMode };

/** 会話のサービス名から、返信に使うプロバイダを返す */
export const getProviderFor = (conversation) => {
	if (conversation?.meta?.demo) return demoProvider;
	const provider = ALL_PROVIDERS.find((p) => p.id === conversation.service);
	if (!provider) throw new Error(`未対応のサービスです: ${conversation.service}`);
	if (!provider.isConfigured()) throw new Error(`${provider.label} の認証情報が設定されていません`);
	return provider;
};

export { demoProvider };
