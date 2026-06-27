"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSite, updateSite, type SiteInput } from "@/lib/notion";

function parseSiteInput(formData: FormData): SiteInput {
  const categories = String(formData.get("categories") ?? "")
    .split(",")
    .map((category) => category.trim())
    .filter(Boolean);

  return {
    name: String(formData.get("name") ?? "").trim(),
    wpUrl: String(formData.get("wpUrl") ?? "").trim(),
    wpUser: String(formData.get("wpUser") ?? "").trim(),
    wpAppPassword: String(formData.get("wpAppPassword") ?? ""),
    systemPrompt: String(formData.get("systemPrompt") ?? ""),
    categories,
    codeBlockFormat: String(formData.get("codeBlockFormat") ?? "").trim(),
    externalKey: String(formData.get("externalKey") ?? "").trim(),
  };
}

export async function createSiteAction(formData: FormData) {
  const input = parseSiteInput(formData);
  const site = await createSite(input);
  revalidatePath("/sites");
  redirect(`/sites/${site.id}`);
}

export async function updateSiteAction(siteId: string, formData: FormData) {
  const input = parseSiteInput(formData);
  await updateSite(siteId, input);
  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/sites");
}
