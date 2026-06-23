import Link from "next/link";
import { listSites } from "@/lib/notion";
import { createSiteAction } from "@/actions/sites";
import SiteFormFields from "@/components/SiteFormFields";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const sites = await listSites();

  return (
    <main className="container">
      <p>
        <Link href="/">← ダッシュボード</Link>
      </p>
      <h1>サイト管理</h1>

      {sites.length > 0 && (
        <ul>
          {sites.map((site) => (
            <li key={site.id}>
              <Link href={`/sites/${site.id}`}>{site.name}</Link>{" "}
              (<Link href={`/sites/${site.id}/keywords`}>キーワード</Link>)
            </li>
          ))}
        </ul>
      )}

      <h2>サイトを追加</h2>
      <form action={createSiteAction}>
        <SiteFormFields />
        <button type="submit">作成</button>
      </form>
    </main>
  );
}
