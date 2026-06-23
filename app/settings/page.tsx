import Link from "next/link";
import { getSettings } from "@/lib/notion";
import { updateSettingsAction } from "@/actions/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <main className="container">
      <p>
        <Link href="/">← ダッシュボード</Link>
      </p>
      <h1>共通設定</h1>
      <form action={updateSettingsAction}>
        <label style={{ flexDirection: "row", alignItems: "center" }}>
          <input
            type="checkbox"
            name="slackEnabled"
            defaultChecked={settings.slackEnabled}
          />
          Slack通知を有効にする
        </label>

        <label>
          AIプロバイダー
          <select name="aiProvider" defaultValue={settings.aiProvider}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </label>

        <label>
          AIモデル
          <input type="text" name="aiModel" defaultValue={settings.aiModel} />
        </label>

        <button type="submit">保存</button>
      </form>
    </main>
  );
}
