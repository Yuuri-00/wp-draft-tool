import { getSite, getSettings, listKeywords, markKeywordUsed } from "./notion";
import { generateArticle } from "./ai";
import { postDraft } from "./wordpress";
import { sendSlack, buildSuccessMessage, buildReplenishMessage } from "./slack";

const REPLENISH_THRESHOLD = 5;

export interface CreateDraftResult {
  postId: number;
  postUrl: string;
  title: string;
}

export async function createDraftForKeyword(
  siteId: string,
  keywordPageId: string
): Promise<CreateDraftResult> {
  const site = await getSite(siteId);
  const settings = await getSettings();
  const keywords = await listKeywords(site.keywordsDbId);
  const keywordItem = keywords.find((k) => k.id === keywordPageId);
  if (!keywordItem) {
    throw new Error("指定されたキーワードが見つかりません。");
  }

  const sequenceNumber =
    keywords.filter((k) => k.postId).length + 1;

  const { title, content, slug } = await generateArticle({
    systemPrompt: site.systemPrompt,
    codeBlockFormat: site.codeBlockFormat,
    keyword: keywordItem.keyword,
    provider: settings.aiProvider,
    model: settings.aiModel,
    sequenceNumber,
  });

  const post = await postDraft(
    { wpUrl: site.wpUrl, wpUser: site.wpUser, wpAppPassword: site.wpAppPassword },
    title,
    content,
    slug
  );

  await markKeywordUsed(keywordPageId, String(post.id));

  if (settings.slackEnabled) {
    await sendSlack(buildSuccessMessage(post));

    const remaining = keywords.filter(
      (k) => !k.postId && k.id !== keywordPageId
    ).length;
    if (remaining <= REPLENISH_THRESHOLD) {
      await sendSlack(buildReplenishMessage(remaining));
    }
  }

  return { postId: post.id, postUrl: post.link, title: post.title.rendered };
}
