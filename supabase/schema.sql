-- 統合チャット受信箱のテーブル定義
-- Supabase ダッシュボード > SQL Editor で実行してください。

create table if not exists public.inbox_conversations (
  id                text primary key,              -- "<service>:<external_id>"
  service           text not null,                 -- slack / chatwork / line / discord
  external_id       text not null,
  name              text not null,
  kind              text not null default 'channel', -- channel / dm / group
  url               text,
  last_message_at   timestamptz,
  last_message_text text,
  last_sender       text,
  unread_count      integer not null default 0,
  last_read_at      timestamptz,
  meta              jsonb not null default '{}'::jsonb,
  updated_at        timestamptz not null default now()
);

create table if not exists public.inbox_messages (
  id              text primary key,                -- "<service>:<external_id>"
  conversation_id text not null references public.inbox_conversations(id) on delete cascade,
  service         text not null,
  external_id     text not null,
  sender_id       text,
  sender_name     text not null default '',
  sender_avatar   text,
  text            text not null default '',
  sent_at         timestamptz not null,
  is_outgoing     boolean not null default false,
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists inbox_messages_conversation_sent_idx on public.inbox_messages (conversation_id, sent_at desc);
create index if not exists inbox_conversations_last_message_idx on public.inbox_conversations (last_message_at desc);

-- サーバー側（service_role キー）からのみアクセスする想定。
-- anon キーからの直接アクセスを防ぐため RLS を有効化し、ポリシーは作成しない。
alter table public.inbox_conversations enable row level security;
alter table public.inbox_messages enable row level security;
