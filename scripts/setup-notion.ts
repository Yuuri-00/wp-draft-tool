import "dotenv/config";
import { setupSitesDatabase, setupSettingsDatabase } from "../lib/notion";

async function main() {
  const parentPageId = process.env.NOTION_PARENT_PAGE_ID;
  if (!process.env.NOTION_API_KEY) {
    throw new Error("NOTION_API_KEY を.envに設定してください。");
  }
  if (!parentPageId) {
    throw new Error(
      "NOTION_PARENT_PAGE_ID を.envに設定してください（Notion Integrationと共有した親ページのID）。"
    );
  }

  console.log("Sites DBを作成中...");
  const sitesDbId = await setupSitesDatabase(parentPageId);
  console.log(`Sites DB作成完了: ${sitesDbId}`);

  console.log("Settings DBを作成中...");
  const settingsDbId = await setupSettingsDatabase(parentPageId);
  console.log(`Settings DB作成完了: ${settingsDbId}`);

  console.log("\n.env / Vercel環境変数に以下を追記してください:");
  console.log(`NOTION_SITES_DB_ID=${sitesDbId}`);
  console.log(`NOTION_SETTINGS_DB_ID=${settingsDbId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
