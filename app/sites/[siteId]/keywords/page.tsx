import Link from "next/link";
import { getSite, listKeywords } from "@/lib/notion";
import { addKeywordAction, createDraftAction, generateKeywordsAction, deleteKeywordAction } from "@/actions/keywords";

export const dynamic = "force-dynamic";

function parseBanner(
  result: string | undefined
): { type: "success" | "error"; text: string } | null {
  if (!result) return null;
  const separatorIndex = result.indexOf(":");
  if (separatorIndex === -1) return null;
  const type = result.slice(0, separatorIndex);
  const encoded = result.slice(separatorIndex + 1);
  if (type === "success") {
    return {
      type: "success",
      text: `下書きを作成しました: ${decodeURIComponent(encoded)}`,
    };
  }
  if (type === "error") {
    return {
      type: "error",
      text: `下書き作成に失敗しました: ${decodeURIComponent(encoded)}`,
    };
  }
  return null;
}

export default async function KeywordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ result?: string; category?: string }>;
}) {
  const { siteId } = await params;
  const { result, category: selectedCategory } = await searchParams;
  const site = await getSite(siteId);
  const allKeywords = await listKeywords(site.keywordsDbId);
  const keywords = selectedCategory
    ? allKeywords.filter((keyword) => keyword.category === selectedCategory)
    : allKeywords;

  const addAction = addKeywordAction.bind(null, siteId, site.keywordsDbId);
  const generateAction = generateKeywordsAction.bind(null, siteId, site.keywordsDbId);
  const banner = parseBanner(result);

  return (
    <main className="container">
      <p>
        <Link href="/sites">← サイト一覧</Link>
        {" › "}
        <Link href={`/sites/${siteId}`}>{site.name} のアカウント設定</Link>
      </p>
      <h1>{site.name} のキーワードリスト</h1>

      {banner && (
        <p className={banner.type === "error" ? "banner-error" : "banner-success"}>
          {banner.text}
        </p>
      )}

      {site.categories.length > 0 && (
        <nav>
          <Link href={`/sites/${siteId}/keywords`}>
            {!selectedCategory ? <strong>すべて</strong> : "すべて"}
          </Link>
          {site.categories.map((category) => (
            <Link
              key={category}
              href={`/sites/${siteId}/keywords?category=${encodeURIComponent(category)}`}
            >
              {category === selectedCategory ? <strong>{category}</strong> : category}
            </Link>
          ))}
        </nav>
      )}

      <form action={addAction} className="add-keyword-form">
        <input type="text" name="keyword" placeholder="新しいキーワード" required />
        {site.categories.length > 0 ? (
          <select name="category" required defaultValue="">
            <option value="" disabled>
              カテゴリを選択
            </option>
            {site.categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        ) : (
          <span>カテゴリ未設定です。サイト設定でカテゴリを追加してください。</span>
        )}
        <button type="submit">追加</button>
      </form>

      {site.categories.length > 0 ? (
        <form action={generateAction} className="add-keyword-form">
          <select name="category" required defaultValue="">
            <option value="" disabled>カテゴリを選択</option>
            {site.categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <input type="number" name="count" min="1" max="20" defaultValue="5" />
          <button type="submit">AIでキーワード生成</button>
        </form>
      ) : (
        <p>AIキーワード生成はカテゴリ設定後に使えます。</p>
      )}

      <table>
        <thead>
          <tr>
            <th>キーワード</th>
            <th>カテゴリ</th>
            <th>状態</th>
            <th>投稿ID</th>
            <th>使用日時</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {keywords.map((keyword) => {
            const used = Boolean(keyword.postId);
            const draftAction = createDraftAction.bind(null, siteId, keyword.id);
            const delAction = deleteKeywordAction.bind(null, siteId, keyword.id);
            return (
              <tr key={keyword.id}>
                <td>{keyword.keyword}</td>
                <td>{keyword.category || "-"}</td>
                <td>{used ? "使用済み" : "未使用"}</td>
                <td>{keyword.postId || "-"}</td>
                <td>
                  {keyword.usedAt
                    ? new Date(keyword.usedAt).toLocaleString("ja-JP")
                    : "-"}
                </td>
                <td>
                  {!used && (
                    <form action={draftAction} style={{ display: "inline" }}>
                      <button type="submit">作成</button>
                    </form>
                  )}
                  <form action={delAction} style={{ display: "inline" }}>
                    <button type="submit">削除</button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {keywords.length === 0 && <p>キーワードがまだありません。</p>}
    </main>
  );
}
