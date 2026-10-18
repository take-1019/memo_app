# 統合チャット受信箱（Unified Chat Inbox）

Slack・Chatwork・LINE 公式アカウント・Discord のメッセージを **1 つの画面に集約**し、
その場から **返信まで**できる Next.js アプリです。

```
┌──────────┬────────────────────┬──────────────────────────────┐
│ サービス │ 会話一覧            │ スレッド                      │
│ すべて   │ [S] #案件-ec   12分前│ 田中: デザイン案確認しましたか？│
│ 未読 (3) │ [C] 株式会社…  58分前│                 自分: 確認しました│
│ Slack    │ [L] 高橋 みなみ 20分前│ ...                          │
│ Chatwork │ [D] #サポート   5分前│ ┌──────────────────────────┐ │
│ LINE     │                    │ │ 返信を入力…      [送信]   │ │
│ Discord  │                    │ └──────────────────────────┘ │
└──────────┴────────────────────┴──────────────────────────────┘
```

## 機能

- 複数サービスの会話を最新順に一覧表示（サービス別・未読のみ・キーワード検索）
- 会話を開くとスレッド表示、未読を自動で既読に
- 返信欄から送信すると、その会話のサービス（Slack / Chatwork / LINE / Discord）に **連携アカウントとして投稿**
- 定期同期（1 分ごと）＋ Webhook（LINE / Slack）で新着を反映、15 秒ごとに画面を自動更新
- 保存先は Supabase（本番）またはメモリ（開発）。未設定ならデモデータで動作
- `INBOX_PASSWORD` による簡易アクセス制限

## 起動

```bash
yarn install
cp .env.example .env.local   # 必要なトークンを記入
yarn dev                     # http://localhost:3000
```

何も設定しなくても **デモモード**（サンプル会話・ローカル返信）で動きます。

## 各サービスの設定

### Slack
1. https://api.slack.com/apps でアプリを作成
2. **OAuth & Permissions** で Bot Token Scopes を追加:
   `channels:read` `groups:read` `im:read` `mpim:read`
   `channels:history` `groups:history` `im:history` `mpim:history`
   `chat:write` `users:read`
3. ワークスペースにインストールし、`xoxb-` から始まるトークンを `SLACK_BOT_TOKEN` に設定
4. 取り込みたいチャンネルで `/invite @アプリ名`
5. （任意・即時反映）**Event Subscriptions** を ON にし、Request URL に
   `https://<ドメイン>/api/webhooks/slack`、イベント `message.channels` `message.groups` `message.im` `message.mpim` を購読。
   **Basic Information** の Signing Secret を `SLACK_SIGNING_SECRET` に設定

### Chatwork
1. Chatwork 右上のアイコン > **サービス連携** > **API Token** を発行
2. `CHATWORK_API_TOKEN` に設定（参加している全ルームが取り込まれます）

### LINE 公式アカウント
1. https://developers.line.biz/ で Messaging API チャネルを作成
2. **チャネルアクセストークン（長期）** を `LINE_CHANNEL_ACCESS_TOKEN`、**チャネルシークレット** を `LINE_CHANNEL_SECRET` に設定
3. Webhook URL に `https://<ドメイン>/api/webhooks/line` を設定し、「Webhook の利用」を ON
4. LINE には履歴取得 API が無いため、**Webhook 設定後に届いたメッセージ**から表示されます。返信はプッシュメッセージで送信されます

### Discord
1. https://discord.com/developers/applications で Bot を作成し、**Message Content Intent** を ON
2. Bot をサーバーに招待（権限: View Channels / Read Message History / Send Messages）
3. Bot Token を `DISCORD_BOT_TOKEN`、サーバー ID を `DISCORD_GUILD_ID` に設定

### Supabase（本番の保存先）
1. `supabase/schema.sql` を Supabase の **SQL Editor** で実行
2. `NEXT_PUBLIC_SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY`（Settings > API）を設定
   ※ service_role キーはサーバー側だけで使われ、ブラウザには送られません

### Vercel にデプロイする場合
- 上記の環境変数を Project Settings に登録
- `INBOX_PASSWORD` を必ず設定（本番で未設定だと、チャット保護のため API が止まります）
- `vercel.json` の Cron は 1 日 1 回 `/api/inbox/sync` を実行します（無料プランの上限）。`CRON_SECRET` も設定してください
- 画面を開いている間は 1 分ごとに自動同期されます
- メモリ保存はサーバーレスでは保持されないため、Supabase を設定してください

## 無料で運用する場合

| サービス | 無料枠 | 注意点 |
|---|---|---|
| Vercel Hobby | 0 円 | 個人・非商用利用のみ。仕事で使うなら Pro（月 20 ドル）が規約上必要。Cron は 1 日 1 回まで |
| Supabase Free | 0 円 | DB 500MB。1 週間アクセスが無いと一時停止（1 日 1 回の Cron で防止） |
| Slack | 0 円 | 無料ワークスペースは直近 90 日分の履歴のみ |
| Chatwork API | 0 円 | 5 分間に 300 回まで。更新のあったルームだけ取得して節約しています |
| LINE Messaging API | 0 円 | プッシュ送信は月 200 通まで。受信から約 1 分以内の返信は無料の応答メッセージで送ります |
| Discord Bot | 0 円 | 特になし |

## 構成

```
lib/inbox/
  types.js             共通スキーマ（Conversation / Message）
  store.js             保存層（Supabase / メモリ）
  sync.js              全サービス同期
  auth.js              簡易認証
  providers/
    slack.js chatwork.js line.js discord.js   各サービスのアダプタ
    demo.js            デモデータ
    index.js           プロバイダ登録
src/pages/api/inbox/
  status.js conversations.js messages.js reply.js read.js sync.js
src/pages/api/webhooks/
  line.js slack.js
components/inbox/
  Sidebar.jsx ConversationList.jsx ThreadView.jsx LoginGate.jsx useInbox.js
src/pages/index.jsx    受信箱画面
src/pages/memo.jsx     （旧）買い物リスト
```

### 新しいサービスを追加する

`lib/inbox/providers/` に次のインターフェースを持つモジュールを追加し、`index.js` の `ALL_PROVIDERS` に登録します。

```js
export const xxxProvider = {
  id: "xxx", label: "Xxx",
  isConfigured: () => Boolean(process.env.XXX_TOKEN),
  fetchConversations: async () => [/* Conversation */],
  fetchMessages: async (conversation) => [/* Message */],
  sendReply: async (conversation, text) => /* Message */,
};
```
