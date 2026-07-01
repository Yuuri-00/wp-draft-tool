"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addKeyword, deleteKeyword, getSite, getSettings } from "@/lib/notion";
import { createDraftForKeyword } from "@/lib/draft-pipeline";
import { generateKeywords } from "@/lib/ai";

export async function addKeywordAction(
  siteId: string,
  keywordsDbId: string,
  formData: FormData
) {
  const keyword = String(formData.get("keyword") ?? "").trim();
  if (!keyword) return;
  const category = String(formData.get("category") ?? "").trim();
  await addKeyword(keywordsDbId, keyword, category);
  revalidatePath(`/sites/${siteId}/keywords`);
}

export async function generateKeywordsAction(
  siteId: string,
  keywordsDbId: string,
  formData: FormData
) {
  const category = String(formData.get("category") ?? "").trim();
  const count = Math.min(20, Math.max(1, Number(formData.get("count") ?? 5)));
  const [site, settings] = await Promise.all([getSite(siteId), getSettings()]);
  const keywords = await generateKeywords({
    systemPrompt: site.systemPrompt,
    category,
    count,
    provider: settings.aiProvider,
    model: settings.aiModel,
  });
  await Promise.all(keywords.map((kw) => addKeyword(keywordsDbId, kw, category)));
  revalidatePath(`/sites/${siteId}/keywords`);
}

export async function deleteKeywordAction(
  siteId: string,
  keywordPageId: string,
  _formData: FormData
) {
  await deleteKeyword(keywordPageId);
  revalidatePath(`/sites/${siteId}/keywords`);
}

export async function createDraftAction(
  siteId: string,
  keywordPageId: string,
  _formData: FormData
) {
  let result: string;
  try {
    const draft = await createDraftForKeyword(siteId, keywordPageId);
    result = `success:${encodeURIComponent(draft.title)}`;
  } catch (err) {
    result = `error:${encodeURIComponent((err as Error).message)}`;
  }
  revalidatePath(`/sites/${siteId}/keywords`);
  redirect(`/sites/${siteId}/keywords?result=${result}`);
}
