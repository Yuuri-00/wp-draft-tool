import Link from "next/link";
import { auth, signOut } from "@/auth";
import { listSites } from "@/lib/notion";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const sites = await listSites();

  return (
    <main className="container">
      <header className="page-header">
        <h1>WP Draft Tool</h1>
        <div>
          <span>{session?.user?.email}</span>{" "}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
            style={{ display: "inline" }}
          >
            <button type="submit">ログアウト</button>
          </form>
        </div>
      </header>

      <nav>
        <Link href="/settings">共通設定</Link>
        <Link href="/sites">サイト管理</Link>
      </nav>

      <section>
        <h2>サイト一覧</h2>
        {sites.length === 0 ? (
          <p>
            サイトがまだありません。「サイト管理」から追加してください。
          </p>
        ) : (
          <ul>
            {sites.map((site) => (
              <li key={site.id}>
                <Link href={`/sites/${site.id}/keywords`}>{site.name}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
