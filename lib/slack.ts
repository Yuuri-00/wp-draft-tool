import type { WordPressPost } from "./wordpress";

export async function sendSlack(text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("SLACK_WEBHOOK_URL が未設定のため、Slack通知をスキップします。");
    return;
  }
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) throw new Error(`HTTPステータス ${response.status}`);
  } catch (err) {
    console.error(`Slack通知失敗（処理は継続します）: ${(err as Error).message}`);
  }
}

export function buildSuccessMessage(post: WordPressPost): string {
  return [
    "*新しい下書きが投稿されました*",
    `タイトル: ${post.title.rendered}`,
    `URL: ${post.link}`,
    `ステータス: ${post.status}`,
  ].join("\n");
}

export function buildReplenishMessage(unusedCount: number): string {
  return `*[WP Draft Tool]* キーワードの残りが ${unusedCount} 件になりました。キーワードの追加をご確認ください。`;
}
