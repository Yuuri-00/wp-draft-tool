"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addKeyword } from "@/lib/notion";
import { createDraftForKeyword } from "@/lib/draft-pipeline";

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
