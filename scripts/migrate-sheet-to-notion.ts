import "dotenv/config";
import path from "node:path";
import { google } from "googleapis";
import { createSite, addKeyword, setKeywordResult } from "../lib/notion";

// 移行元サイトの内容（旧article-rules.json相当）は環境変数から読み込む。
// このスクリプト自体はサイト固有の値を持たない汎用的な移行ツールとして保つ
// （実データは.env側に書く。.envはリポジトリには含まれない）。

async function getSheetRows(): Promise<string[][]> {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const sheetName = process.env.GOOGLE_SHEET_NAME || "keywords";
  const keyFile = path.resolve(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || "./credentials/service-account.json"
  );
  if (!spreadsheetId) throw new Error("GOOGLE_SPREADSHEET_ID が未設定です。");

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:C`,
  });
  return res.data.values ?? [];
}

function parseUsedAt(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function main() {
  const wpUrl = process.env.WP_URL;
  const wpUser = process.env.WP_USER;
  const wpAppPassword = process.env.WP_APP_PASSWORD;
  const siteName = process.env.MIGRATE_SITE_NAME;
  const systemPrompt = process.env.MIGRATE_SYSTEM_PROMPT;
  const codeBlockFormat = process.env.MIGRATE_CODE_BLOCK_FORMAT ?? "";
  if (!wpUrl || !wpUser || !wpAppPassword) {
    throw new Error("WP_URL / WP_USER / WP_APP_PASSWORD を.envに設定してください。");
  }
  if (!siteName || !systemPrompt) {
    throw new Error(
      "MIGRATE_SITE_NAME / MIGRATE_SYSTEM_PROMPT を.envに設定してください（移行元サイトの名前とキャラ設定）。"
    );
  }

  console.log("Notion上にSiteを作成中...");
  const site = await createSite({
    name: siteName,
    wpUrl,
    wpUser,
    wpAppPassword,
    systemPrompt,
    categories: [],
    codeBlockFormat,
    externalKey: "",
  });
  console.log(`Site作成完了: ${site.id} (Keywords DB: ${site.keywordsDbId})`);
  console.log(
    "カテゴリは未設定です。アカウント設定画面（/sites/[siteId]）でカテゴリを追加してください。"
  );

  console.log("Google Sheetsからキーワードを読込中...");
  const rows = await getSheetRows();
  const dataRows = rows.slice(1); // 1行目はヘッダー

  let migrated = 0;
  for (const row of dataRows) {
    const [keyword, postId, usedAtRaw] = row;
    if (!keyword) continue;
    const item = await addKeyword(site.keywordsDbId, keyword, "");
    if (postId) {
      await setKeywordResult(item.id, postId, parseUsedAt(usedAtRaw));
    }
    migrated += 1;
  }

  console.log(`移行完了: ${migrated} 件のキーワードをNotionへ移行しました。`);
  console.log(`Sites DBに作成されたSite ID: ${site.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
