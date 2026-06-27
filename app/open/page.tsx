import { redirect } from "next/navigation";
import { findSiteByExternalKey } from "@/lib/notion";
import { createSiteAction } from "@/actions/sites";
import SiteFormFields from "@/components/SiteFormFields";

export const dynamic = "force-dynamic";

export default async function OpenPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;

  if (!key) {
    return (
      <main className="container">
        <h1>サイトを開く</h1>
        <p>キーが指定されていません。</p>
      </main>
    );
  }

  const site = await findSiteByExternalKey(key);
  if (site) {
    redirect(`/sites/${site.id}/keywords`);
  }

  return (
    <main className="container">
      <h1>サイトを開く</h1>
      <p>
        外部連携キー「{key}」に対応するサイトがまだありません。下のフォームから新規作成してください。
      </p>
      <form action={createSiteAction}>
        <SiteFormFields defaultValues={{ externalKey: key }} />
        <button type="submit">作成</button>
      </form>
    </main>
  );
}
