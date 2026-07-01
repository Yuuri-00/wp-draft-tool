import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type { AiProvider } from "./notion";

export interface GenerateArticleInput {
  systemPrompt: string;
  codeBlockFormat: string;
  keyword: string;
  provider: AiProvider;
  model: string;
  sequenceNumber: number;
}

export interface GeneratedArticle {
  title: string;
  content: string;
  slug: string;
}

function extractJson<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("AIからの応答をJSONとして解析できませんでした。");
  }
  try {
    return JSON.parse(match[0]) as T;
  } catch (err) {
    throw new Error(`AI応答のJSONパースに失敗しました: ${(err as Error).message}`);
  }
}

async function callOpenAI(
  systemPrompt: string,
  userContent: string,
  model: string
): Promise<string> {
  const client = new OpenAI();
  const completion = await client.chat.completions.create({
    model,
    max_tokens: 4096,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });
  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("OpenAIからの応答が空です。");
  return text;
}

async function callAnthropic(
  systemPrompt: string,
  userContent: string,
  model: string
): Promise<string> {
  const client = new Anthropic();
  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  });
  const block = message.content[0];
  if (!block || block.type !== "text") {
    throw new Error("Anthropicからの応答にテキストが含まれていません。");
  }
  return block.text;
}

async function callModel(
  provider: AiProvider,
  model: string,
  systemPrompt: string,
  userContent: string
): Promise<string> {
  return provider === "anthropic"
    ? callAnthropic(systemPrompt, userContent, model)
    : callOpenAI(systemPrompt, userContent, model);
}

interface StepContext {
  systemPrompt: string;
  codeBlockFormat: string;
  keyword: string;
  provider: AiProvider;
  model: string;
}

// --- 1. 見出し作成 ---

async function generateOutline(ctx: StepContext): Promise<string[]> {
  const userContent = `以下のキーワードをテーマにした日本語ブログ記事の見出し構成を考えてください。

キーワード: ${ctx.keyword}

次の構成パターンの中から、このキーワードに最も合うものを1つ選んで見出しを作成してください（どのパターンを選んだかは出力に含めなくてよい）：
- 結論ファースト型: 最初に結論を示し、その後で理由・原因を深掘りする（トラブル解決・Q&A的な内容に向く）
- 比較型: 複数の選択肢や方法を比較し、それぞれの向き・不向きを示す
- 手順解説型: 操作・設定などの手順を順番に説明する
- 概念解説型: 初心者向けに概念の定義から具体例・応用まで順に説明する

以下のJSON形式のみで返してください（説明文・コードブロック不要）：
{"headings":["見出し1","見出し2", ...]}

【ルール】
- H2見出しを7〜8個作成する
- 最後の見出しは「まとめ」にする`;

  const text = await callModel(ctx.provider, ctx.model, ctx.systemPrompt, userContent);
  const { headings } = extractJson<{ headings: string[] }>(text);
  if (!Array.isArray(headings) || headings.length === 0) {
    throw new Error("見出しの生成結果が空です。");
  }
  return headings;
}

// --- 2. 各見出しの本文執筆 ---

async function generateSectionBody(
  ctx: StepContext,
  params: { heading: string; headings: string[]; index: number }
): Promise<string> {
  const needsCodeExample = params.index === 1 && Boolean(ctx.codeBlockFormat);
  const userContent = `あなたは下記の記事の一部を執筆しています。

キーワード: ${ctx.keyword}
記事全体の見出し一覧: ${params.headings.join(" / ")}
今回執筆する見出し: ${params.heading}（${params.index + 1}/${params.headings.length}番目）

以下のJSON形式のみで返してください（説明文・コードブロック不要）：
{"body":"本文のHTML"}

【ルール】
- 他の見出しと内容が重複しないよう、この見出しのテーマに絞って書く
- HTMLタグで記述する（<p>, <ul>, <li>, <strong> など。見出しタグ自体は含めない）
- 文字数は200〜350文字程度
${
  needsCodeExample
    ? `- この見出しの中に、コード例を最低1つ含める。出力形式は次の通り：
  ${ctx.codeBlockFormat}`
    : ""
}`;

  const text = await callModel(ctx.provider, ctx.model, ctx.systemPrompt, userContent);
  const { body } = extractJson<{ body: string }>(text);
  if (!body) throw new Error("本文の生成結果が空です。");
  return body;
}

// --- 3. 統合・推敲 ---

async function polishArticle(
  ctx: StepContext,
  sections: { heading: string; body: string }[]
): Promise<string> {
  const sectionsText = sections
    .map((section) => `見出し: ${section.heading}\n本文: ${section.body}`)
    .join("\n\n");

  const userContent = `以下は記事の見出しと本文のペアです。これらを1つのHTML記事として統合し、文章を推敲してください。

キーワード: ${ctx.keyword}

${sectionsText}

以下のJSON形式のみで返してください（説明文・コードブロック不要）：
{"content":"統合・推敲後の記事本文（HTML）"}

【ルール】
- 各見出しは<h2>タグで記述し、対応する本文をその直後に配置する
- 文章の重複表現・冗長な言い回しを削り、全体を通して読みやすく自然な日本語に整える
- 元のコード例のHTML（タグ・属性）は変更せずそのまま保持する
- 見出しの文言や順序は変更しない`;

  const text = await callModel(ctx.provider, ctx.model, ctx.systemPrompt, userContent);
  const { content } = extractJson<{ content: string }>(text);
  if (!content) throw new Error("記事本文の生成結果が空です。");
  return content;
}

// --- 4. タイトル作成 ---

async function generateTitle(ctx: StepContext, content: string): Promise<string> {
  const excerpt = content.slice(0, 500);
  const userContent = `以下の記事のタイトルを作成してください。

キーワード: ${ctx.keyword}
記事本文（冒頭）: ${excerpt}

以下のJSON形式のみで返してください（説明文・コードブロック不要）：
{"title":"記事のタイトル"}

【ルール】
- 検索キーワード「${ctx.keyword}」を自然な形でタイトルに含める
- 記事の内容を正確に反映し、読者がクリックしたくなるタイトルにする
- 30〜40文字程度を目安にする`;

  const text = await callModel(ctx.provider, ctx.model, ctx.systemPrompt, userContent);
  const { title } = extractJson<{ title: string }>(text);
  if (!title) throw new Error("タイトルの生成結果が空です。");
  return title;
}

// --- 5. スラッグ作成（キーワードの英語化＋連番） ---

const SLUG_TRANSLATOR_SYSTEM_PROMPT =
  "あなたは優秀な翻訳者兼SEOエンジニアです。日本語のキーワードを、WordPressのURLスラッグに適した英語表現に変換します。";

async function generateSlug(
  provider: AiProvider,
  model: string,
  keyword: string,
  sequenceNumber: number
): Promise<string> {
  const userContent = `次の日本語キーワードを、WordPressのスラッグ（URL用の英語表記）に変換してください。

キーワード: ${keyword}

以下のJSON形式のみで返してください（説明文・コードブロック不要）：
{"slug":"english-slug-format"}

【ルール】
- 半角英数字とハイフンのみを使用する（小文字、kebab-case）
- 日本語キーワードの意味を表す自然な英語に翻訳する
- 単語数は2〜5語程度`;

  const text = await callModel(provider, model, SLUG_TRANSLATOR_SYSTEM_PROMPT, userContent);
  const { slug } = extractJson<{ slug: string }>(text);
  if (!slug) throw new Error("スラッグの生成結果が空です。");

  const sanitized = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const sequence = String(sequenceNumber).padStart(3, "0");
  return `${sanitized}-${sequence}`;
}

// --- キーワード生成 ---

export interface GenerateKeywordsInput {
  systemPrompt: string;
  category: string;
  count: number;
  provider: AiProvider;
  model: string;
}

export async function generateKeywords(input: GenerateKeywordsInput): Promise<string[]> {
  const userContent = `カテゴリ「${input.category}」向けのSEOキーワードを${input.count}件提案してください。

以下のJSON形式のみで返してください（説明文・コードブロック不要）：
{"keywords":["キーワード1","キーワード2",...]}

【ルール】
- 読者が実際に検索しそうな具体的なキーワード
- 各キーワードは10〜30文字程度
- 重複なし、${input.count}件ちょうど返す`;

  const text = await callModel(input.provider, input.model, input.systemPrompt, userContent);
  const { keywords } = extractJson<{ keywords: string[] }>(text);
  if (!Array.isArray(keywords) || keywords.length === 0) {
    throw new Error("キーワードの生成結果が空です。");
  }
  return keywords;
}

// --- オーケストレーター ---

export async function generateArticle(
  input: GenerateArticleInput
): Promise<GeneratedArticle> {
  const ctx: StepContext = {
    systemPrompt: input.systemPrompt,
    codeBlockFormat: input.codeBlockFormat,
    keyword: input.keyword,
    provider: input.provider,
    model: input.model,
  };

  const headings = await generateOutline(ctx);

  const sections: { heading: string; body: string }[] = [];
  for (let index = 0; index < headings.length; index++) {
    const heading = headings[index];
    const body = await generateSectionBody(ctx, { heading, headings, index });
    sections.push({ heading, body });
  }

  const content = await polishArticle(ctx, sections);
  const title = await generateTitle(ctx, content);
  const slug = await generateSlug(
    input.provider,
    input.model,
    input.keyword,
    input.sequenceNumber
  );

  return { title, content, slug };
}
