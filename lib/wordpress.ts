export interface WordPressCredentials {
  wpUrl: string;
  wpUser: string;
  wpAppPassword: string;
}

export interface WordPressPost {
  id: number;
  status: string;
  link: string;
  title: { rendered: string };
}

export async function postDraft(
  credentials: WordPressCredentials,
  title: string,
  content: string,
  slug: string
): Promise<WordPressPost> {
  const basicAuth = Buffer.from(
    `${credentials.wpUser}:${credentials.wpAppPassword}`
  ).toString("base64");

  const response = await fetch(`${credentials.wpUrl}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${basicAuth}`,
    },
    body: JSON.stringify({ title, content, status: "draft", slug }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`投稿失敗 [${response.status}]: ${JSON.stringify(error)}`);
  }

  return response.json();
}
