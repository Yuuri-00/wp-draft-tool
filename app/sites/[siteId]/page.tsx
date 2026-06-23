import Link from "next/link";
import { getSite } from "@/lib/notion";
import { updateSiteAction } from "@/actions/sites";
import SiteFormFields from "@/components/SiteFormFields";

export const dynamic = "force-dynamic";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  const action = updateSiteAction.bind(null, siteId);

  return (
    <main className="container">
      <p>
        <Link href="/sites">← サイト一覧</Link>
      </p>
      <h1>{site.name} のアカウント設定</h1>
      <p>
        <Link href={`/sites/${siteId}/keywords`}>
          キーワードリストを見る →
        </Link>
      </p>
      <form action={action}>
        <SiteFormFields
          defaultValues={{ ...site, categories: site.categories.join(", ") }}
        />
        <button type="submit">保存</button>
      </form>
    </main>
  );
}
