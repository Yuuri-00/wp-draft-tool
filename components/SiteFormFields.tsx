export interface SiteFormDefaults {
  name?: string;
  wpUrl?: string;
  wpUser?: string;
  wpAppPassword?: string;
  systemPrompt?: string;
  categories?: string;
  codeBlockFormat?: string;
  externalKey?: string;
}

export default function SiteFormFields({
  defaultValues = {},
}: {
  defaultValues?: SiteFormDefaults;
}) {
  return (
    <>
      <label>
        サイト名
        <input name="name" defaultValue={defaultValues.name} required />
      </label>
      <label>
        WordPress URL
        <input
          name="wpUrl"
          type="url"
          defaultValue={defaultValues.wpUrl}
          placeholder="https://example.com"
          required
        />
      </label>
      <label>
        WordPressユーザー名
        <input name="wpUser" defaultValue={defaultValues.wpUser} required />
      </label>
      <label>
        WordPressアプリパスワード
        <input
          name="wpAppPassword"
          type="password"
          defaultValue={defaultValues.wpAppPassword}
          required
        />
      </label>
      <label>
        システムプロンプト（AIへのキャラクター・読者定義）
        <textarea
          name="systemPrompt"
          rows={4}
          defaultValue={defaultValues.systemPrompt}
          required
        />
      </label>
      <label>
        カテゴリ一覧（カンマ区切りで入力。キーワード追加時にこの一覧から選びます）
        <input
          name="categories"
          defaultValue={defaultValues.categories}
          placeholder="文法, ライブラリ, エラー対応"
        />
      </label>
      <label>
        コードブロックの出力形式（任意。プラグイン等で形式が決まっている場合のみ入力。空欄なら通常の{" "}
        {"<pre><code>"}を使用）
        <textarea
          name="codeBlockFormat"
          rows={3}
          defaultValue={defaultValues.codeBlockFormat}
          placeholder='<div class="my-plugin-codeblock"><pre><code>...</code></pre></div>'
        />
      </label>
      <label>
        外部連携キー（任意。外部から連携する際にこのサイトを識別するための任意の文字列）
        <input
          name="externalKey"
          defaultValue={defaultValues.externalKey}
          placeholder="例：my-blog"
        />
      </label>
    </>
  );
}
