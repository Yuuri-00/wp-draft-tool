# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

開発時の運用ルールは `.claude/rules/` を参照（設定の汎用性に関する判断基準、設計変更時の手順など）。

## 概要

複数のWordPressブログを横断管理し、Notionに保存したキーワードからAIで記事を生成して下書き投稿するNext.js（App Router / TypeScript）アプリ。Googleアカウントでログインし、許可したメールアドレスのみアクセスできる。Vercelへのデプロイを前提とする。

旧バージョン（`create-draft.js` を手動/cron実行するCLI、Google Sheetsをキーワード管理に使用）はこのWeb UIに完全に置き換えられた。

## 実行

```bash
npm install                  # 初回のみ
npm run setup-notion         # 初回のみ：Notionに Sites DB / Settings DB を作成
npm run dev                  # ローカル開発サーバー
npm run build && npm start   # 本番ビルド/起動
```

## アーキテクチャ

```
app/
 ├─ page.tsx                          ダッシュボード（サイト一覧）
 ├─ login/page.tsx                    Googleログイン
 ├─ settings/page.tsx                 共通設定（Slack ON/OFF・AIプロバイダー/モデル）
 ├─ sites/page.tsx                    サイト一覧＋追加フォーム
 ├─ sites/[siteId]/page.tsx           サイトのアカウント設定（WP認証・キャラ設定・カテゴリ一覧編集）
 ├─ sites/[siteId]/keywords/page.tsx  キーワードリスト（カテゴリ絞り込み／追加ボタン／作成ボタン）
 └─ api/auth/[...nextauth]/route.ts   Auth.js ハンドラ

actions/   サーバーアクション（フォームのsubmit先）
 ├─ sites.ts      createSiteAction / updateSiteAction
 ├─ keywords.ts   addKeywordAction / createDraftAction
 └─ settings.ts   updateSettingsAction

lib/
 ├─ notion.ts          Notionとの全データ操作（Sites/Settings/Keywords CRUD、専用DB自動作成）
 ├─ ai.ts              generateArticle（5段階パイプライン。OpenAI / Anthropic 切替）
 ├─ wordpress.ts       postDraft（WordPress REST APIへ下書き投稿、Basic認証、slug指定）
 ├─ slack.ts           sendSlack / 通知メッセージ組み立て
 └─ draft-pipeline.ts  「生成→WP投稿→Notion更新→Slack通知」の一連処理（createDraftForKeyword）

proxy.ts        未ログイン時に/loginへリダイレクト（Next.js 16でmiddleware.tsから改名）
auth.ts         Auth.js設定（Googleプロバイダー＋メール許可リスト）

scripts/
 ├─ setup-notion.ts             Sites DB / Settings DB の初回プロビジョニング
 └─ migrate-sheet-to-notion.ts  旧Google Sheetsのキーワードをサイト専用Keywords DBへ1回限り移行
```

**下書き作成の処理順序:** （`lib/draft-pipeline.ts#createDraftForKeyword`）
Notionからサイト設定・共通設定・キーワード取得 → AI記事生成（5段階） → WordPress下書き投稿（slug付き） → Notionのキーワード行を使用済みに更新 → Slack ON時のみ成功通知＋残数5件以下で補充警告。

### AI記事生成の5段階（`lib/ai.ts#generateArticle`）

各ステップへの指示文はコードに固定。サイトごとに編集可能なのは `systemPrompt`（キャラ・読者設定）と `codeBlockFormat`（任意。プラグイン等でコードブロックのHTML形式が決まっている場合のみ）の2つ。site固有の前提（特定言語・特定プラグイン名など）をプロンプトに直書きしないという判断基準は [`.claude/rules/generalize-config-separation.md`](.claude/rules/generalize-config-separation.md) を参照。

1. 見出し作成 — 「結論ファースト型／比較型／手順解説型／概念解説型」の中からキーワードに合うものをAIが選び、H2見出し7〜8個（最後は「まとめ」）を生成
2. 各見出しの本文執筆 — 見出しごとにループしてHTML本文を生成。`codeBlockFormat` が設定されているサイトのみ、2番目のセクションにその形式でコード例を必須化（未設定サイトではコード例の指示自体を出さない）
3. 統合・推敲 — 全セクションを結合し、重複・冗長表現を整える
4. タイトル作成 — キーワードを自然に含め、内容を正確に反映したSEOタイトルを生成（特定ジャンル前提のパターンは持たない）
5. スラッグ作成 — キーワードをAIで英語化しkebab-case化、`sequenceNumber`（そのサイトで投稿済みの件数+1）をゼロ埋め3桁で連結

1記事あたりのAI呼び出しは1回→約11回（見出し1 + 本文7〜8 + 推敲1 + タイトル1 + スラッグ1）に増える。

## Notionデータモデル

- **Sites DB**（`NOTION_SITES_DB_ID`）: 1ページ=1サイト。Name / WP URL / WP User / WP App Password / System Prompt / Categories（カンマ区切り） / Code Block Format（任意） / Keywords DB ID。
- **Settings DB**（`NOTION_SETTINGS_DB_ID`）: シングルトン（1行のみ運用）。Slack Notifications Enabled / AI Provider（openai・anthropic） / AI Model。
- **Keywords DB**: サイトごとに `createSite()` 実行時にAPIで自動生成され、IDがSites DBの該当行に保存される。Keyword / Category / Post ID / Used At。カテゴリはSites DBの `Categories` から選択する想定（Notionのselect型ではなくrich_text）。

Notionの `rich_text` は1要素2000文字制限があるため、`lib/notion.ts` の `toRichText`/`fromRichText` で分割・結合している。

機密情報（NOTION_API_KEY、OPENAI_API_KEY、ANTHROPIC_API_KEY、SLACK_WEBHOOK_URL、Google OAuth資格情報）はNotionに置かず、すべて環境変数（Vercel環境変数）で管理する。

## 認証

`auth.ts` で Auth.js（next-auth v5）+ Googleプロバイダーを使用。`signIn` callbackで、ログインしたGoogleアカウントのメールが `ALLOWED_EMAILS`（カンマ区切り）に含まれない場合はログインを拒否する。`proxy.ts` が `/login` と `/api/auth/*` 以外の全ルートを保護する。

Google Cloud ConsoleでのOAuthクライアント作成（リダイレクトURIをVercelの本番/プレビューURLに設定）はユーザー側の作業。

## 環境変数（`.env` / Vercel環境変数）

| 変数名 | 説明 |
|---|---|
| `NOTION_API_KEY` | Notion Internal Integrationのトークン |
| `NOTION_PARENT_PAGE_ID` | Integrationと共有した親ページのID（Sites/Settings/各サイトのKeywords DBの作成先） |
| `NOTION_SITES_DB_ID` | `npm run setup-notion` 実行後に出力されるSites DBのID |
| `NOTION_SETTINGS_DB_ID` | 同上、Settings DBのID |
| `AUTH_SECRET` | Auth.jsのセッション暗号化用シークレット |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuthクライアント |
| `ALLOWED_EMAILS` | ログインを許可するメールアドレス（カンマ区切り） |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL（未設定時は通知スキップ） |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | 各AIプロバイダーのAPIキー（使用するプロバイダーはSettings DBで選択） |
| `WP_URL` / `WP_USER` / `WP_APP_PASSWORD` | `migrate-sheet-to-notion.ts` でのみ使用（移行後の本番運用ではNotionのSites DBに保存） |
| `GOOGLE_SPREADSHEET_ID` / `GOOGLE_SHEET_NAME` / `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | 同上、旧Google Sheets読み込み用 |
| `MIGRATE_SITE_NAME` / `MIGRATE_SYSTEM_PROMPT` / `MIGRATE_CODE_BLOCK_FORMAT` | 同上、移行元サイトの名前・キャラ設定・コードブロック形式（任意）。サイト固有の内容なのでスクリプト本体にはハードコードせず`.env`にのみ書く |

`credentials/` は `.gitignore` 済み。

## 今後の拡張予定

- **キーワード自動生成（未着手・未実装）**: `/sites/[siteId]/keywords` 画面に「AIでキーワード作成」ボタンを追加し、サイト情報（ターゲット等、`systemPrompt`相当）とカテゴリ・件数を指定してAIに複数キーワードを生成させ、Keywords DBへ一括追加する機能。`lib/ai.ts`の`generateKeywords`相当の実装と、UI側のボタン・フォーム追加が必要（着手前に設計確認が必要）
- Settings DBでの補充閾値（現在 `REPLENISH_THRESHOLD = 5` で固定）の編集可能化
- `migrate-sheet-to-notion.ts` で移行したキーワードはCategory未設定のまま。一括カテゴリ付けの仕組みは未実装（現状はキーワードリスト画面から個別に設定し直す想定）
