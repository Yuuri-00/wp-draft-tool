import { Client } from "@notionhq/client";

let cachedClient: Client | null = null;

function notion(): Client {
  if (!cachedClient) {
    const apiKey = process.env.NOTION_API_KEY;
    if (!apiKey) throw new Error("NOTION_API_KEY が未設定です。");
    cachedClient = new Client({ auth: apiKey });
  }
  return cachedClient;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} が未設定です。`);
  return value;
}

// NOTION_SITES_DB_ID / NOTION_SETTINGS_DB_ID には、データベースIDではなく
// その配下にある「データソースID」を保存する（Notion API 2025-09-03以降、
// 行のクエリ・作成はデータソース単位で行うため）。
const sitesDataSourceId = () => requiredEnv("NOTION_SITES_DB_ID");
const settingsDataSourceId = () => requiredEnv("NOTION_SETTINGS_DB_ID");
const parentPageId = () => requiredEnv("NOTION_PARENT_PAGE_ID");

// Notionのrich_textは1要素あたり2000文字制限があるため、複数要素に分割して保存する。
const RICH_TEXT_CHUNK_SIZE = 2000;

function toRichText(text: string) {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += RICH_TEXT_CHUNK_SIZE) {
    chunks.push(text.slice(i, i + RICH_TEXT_CHUNK_SIZE));
  }
  if (chunks.length === 0) chunks.push("");
  return chunks.map((content) => ({ text: { content } }));
}

function fromRichText(richText: { plain_text: string }[] | undefined): string {
  return (richText ?? []).map((rt) => rt.plain_text).join("");
}

// 新規データベース作成直後のレスポンスから、デフォルトのデータソースIDを取り出す。
 
function firstDataSourceId(database: any): string {
  const dataSourceId = database.data_sources?.[0]?.id;
  if (!dataSourceId) throw new Error("データベースのデータソースが見つかりません。");
  return dataSourceId;
}

// --- Sites ---

export interface Site {
  id: string;
  name: string;
  wpUrl: string;
  wpUser: string;
  wpAppPassword: string;
  systemPrompt: string;
  categories: string[];
  codeBlockFormat: string;
  keywordsDbId: string;
}

export interface SiteInput {
  name: string;
  wpUrl: string;
  wpUser: string;
  wpAppPassword: string;
  systemPrompt: string;
  categories: string[];
  codeBlockFormat: string;
}

function parseCategories(text: string): string[] {
  return text
    .split(",")
    .map((category) => category.trim())
    .filter(Boolean);
}


function pageToSite(page: any): Site {
  const props = page.properties;
  return {
    id: page.id,
    name: fromRichText(props.Name?.title),
    wpUrl: props["WP URL"]?.url ?? "",
    wpUser: fromRichText(props["WP User"]?.rich_text),
    wpAppPassword: fromRichText(props["WP App Password"]?.rich_text),
    systemPrompt: fromRichText(props["System Prompt"]?.rich_text),
    categories: parseCategories(fromRichText(props["Categories"]?.rich_text)),
    codeBlockFormat: fromRichText(props["Code Block Format"]?.rich_text),
    keywordsDbId: fromRichText(props["Keywords DB ID"]?.rich_text),
  };
}

export async function listSites(): Promise<Site[]> {
  const res = await notion().dataSources.query({
    data_source_id: sitesDataSourceId(),
  });
  return res.results.map(pageToSite);
}

export async function getSite(siteId: string): Promise<Site> {
  const page = await notion().pages.retrieve({ page_id: siteId });
  return pageToSite(page);
}

export async function createSite(input: SiteInput): Promise<Site> {
  const keywordsDbId = await provisionKeywordsDatabase(input.name);
  const page = await notion().pages.create({
    parent: { data_source_id: sitesDataSourceId() },
    properties: {
      Name: { title: [{ text: { content: input.name } }] },
      "WP URL": { url: input.wpUrl },
      "WP User": { rich_text: toRichText(input.wpUser) },
      "WP App Password": { rich_text: toRichText(input.wpAppPassword) },
      "System Prompt": { rich_text: toRichText(input.systemPrompt) },
      Categories: { rich_text: toRichText(input.categories.join(", ")) },
      "Code Block Format": { rich_text: toRichText(input.codeBlockFormat) },
      "Keywords DB ID": { rich_text: toRichText(keywordsDbId) },
    },
  });
  return pageToSite(page);
}

export async function updateSite(siteId: string, input: SiteInput): Promise<Site> {
  const page = await notion().pages.update({
    page_id: siteId,
    properties: {
      Name: { title: [{ text: { content: input.name } }] },
      "WP URL": { url: input.wpUrl },
      "WP User": { rich_text: toRichText(input.wpUser) },
      "WP App Password": { rich_text: toRichText(input.wpAppPassword) },
      "System Prompt": { rich_text: toRichText(input.systemPrompt) },
      Categories: { rich_text: toRichText(input.categories.join(", ")) },
      "Code Block Format": { rich_text: toRichText(input.codeBlockFormat) },
    },
  });
  return pageToSite(page);
}

async function provisionKeywordsDatabase(siteName: string): Promise<string> {
  const db = await notion().databases.create({
    parent: { type: "page_id", page_id: parentPageId() },
    title: [{ text: { content: `Keywords - ${siteName}` } }],
    initial_data_source: {
      properties: {
        Keyword: { title: {} },
        Category: { rich_text: {} },
        "Post ID": { rich_text: {} },
        "Used At": { date: {} },
      },
    },
  });
  return firstDataSourceId(db);
}

// --- Settings (シングルトン: Settings DBには常に1行のみ存在する想定) ---

export type AiProvider = "openai" | "anthropic";

export interface Settings {
  id: string;
  slackEnabled: boolean;
  aiProvider: AiProvider;
  aiModel: string;
}

export interface SettingsInput {
  slackEnabled: boolean;
  aiProvider: AiProvider;
  aiModel: string;
}

 
function pageToSettings(page: any): Settings {
  const props = page.properties;
  return {
    id: page.id,
    slackEnabled: props["Slack Notifications Enabled"]?.checkbox ?? false,
    aiProvider: (props["AI Provider"]?.select?.name ?? "openai") as AiProvider,
    aiModel: fromRichText(props["AI Model"]?.rich_text) || "gpt-4o-mini",
  };
}

export async function getSettings(): Promise<Settings> {
  const res = await notion().dataSources.query({
    data_source_id: settingsDataSourceId(),
    page_size: 1,
  });
  if (res.results.length === 0) {
    throw new Error(
      "Settings DBに行がありません。npm run setup-notion を実行してください。"
    );
  }
  return pageToSettings(res.results[0]);
}

export async function updateSettings(
  settingsId: string,
  input: SettingsInput
): Promise<Settings> {
  const page = await notion().pages.update({
    page_id: settingsId,
    properties: {
      "Slack Notifications Enabled": { checkbox: input.slackEnabled },
      "AI Provider": { select: { name: input.aiProvider } },
      "AI Model": { rich_text: toRichText(input.aiModel) },
    },
  });
  return pageToSettings(page);
}

// --- Keywords (サイトごとに動的生成されたデータソース) ---

export interface KeywordItem {
  id: string;
  keyword: string;
  category: string;
  postId: string;
  usedAt: string | null;
}


function pageToKeyword(page: any): KeywordItem {
  const props = page.properties;
  return {
    id: page.id,
    keyword: fromRichText(props.Keyword?.title),
    category: fromRichText(props.Category?.rich_text),
    postId: fromRichText(props["Post ID"]?.rich_text),
    usedAt: props["Used At"]?.date?.start ?? null,
  };
}

export async function listKeywords(keywordsDbId: string): Promise<KeywordItem[]> {
   
  const results: any[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion().dataSources.query({
      data_source_id: keywordsDbId,
      start_cursor: cursor,
    });
    results.push(...res.results);
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return results.map(pageToKeyword);
}

export async function addKeyword(
  keywordsDbId: string,
  keyword: string,
  category: string
): Promise<KeywordItem> {
  const page = await notion().pages.create({
    parent: { data_source_id: keywordsDbId },
    properties: {
      Keyword: { title: [{ text: { content: keyword } }] },
      Category: { rich_text: toRichText(category) },
    },
  });
  return pageToKeyword(page);
}

export async function setKeywordResult(
  keywordPageId: string,
  postId: string,
  usedAt: string | null
): Promise<void> {
  await notion().pages.update({
    page_id: keywordPageId,
    properties: {
      "Post ID": { rich_text: toRichText(postId) },
      "Used At": usedAt ? { date: { start: usedAt } } : { date: null },
    },
  });
}

export async function markKeywordUsed(
  keywordPageId: string,
  postId: string
): Promise<void> {
  await setKeywordResult(keywordPageId, postId, new Date().toISOString());
}

// --- 初回セットアップ用 (scripts/setup-notion.ts から呼ばれる) ---

export async function setupSitesDatabase(parentPage: string): Promise<string> {
  const db = await notion().databases.create({
    parent: { type: "page_id", page_id: parentPage },
    title: [{ text: { content: "Sites" } }],
    initial_data_source: {
      properties: {
        Name: { title: {} },
        "WP URL": { url: {} },
        "WP User": { rich_text: {} },
        "WP App Password": { rich_text: {} },
        "System Prompt": { rich_text: {} },
        Categories: { rich_text: {} },
        "Code Block Format": { rich_text: {} },
        "Keywords DB ID": { rich_text: {} },
      },
    },
  });
  return firstDataSourceId(db);
}

export async function setupSettingsDatabase(parentPage: string): Promise<string> {
  const db = await notion().databases.create({
    parent: { type: "page_id", page_id: parentPage },
    title: [{ text: { content: "Settings" } }],
    initial_data_source: {
      properties: {
        Name: { title: {} },
        "Slack Notifications Enabled": { checkbox: {} },
        "AI Provider": {
          select: { options: [{ name: "openai" }, { name: "anthropic" }] },
        },
        "AI Model": { rich_text: {} },
      },
    },
  });
  const settingsDataSourceId = firstDataSourceId(db);
  await notion().pages.create({
    parent: { data_source_id: settingsDataSourceId },
    properties: {
      Name: { title: [{ text: { content: "Default" } }] },
      "Slack Notifications Enabled": { checkbox: true },
      "AI Provider": { select: { name: "openai" } },
      "AI Model": { rich_text: [{ text: { content: "gpt-4o-mini" } }] },
    },
  });
  return settingsDataSourceId;
}
