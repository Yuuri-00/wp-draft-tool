"use server";

import { revalidatePath } from "next/cache";
import { getSettings, updateSettings, type AiProvider } from "@/lib/notion";

export async function updateSettingsAction(formData: FormData) {
  const current = await getSettings();
  await updateSettings(current.id, {
    slackEnabled: formData.get("slackEnabled") === "on",
    aiProvider: (formData.get("aiProvider") as AiProvider) ?? "openai",
    aiModel: String(formData.get("aiModel") ?? "").trim() || "gpt-4o-mini",
  });
  revalidatePath("/settings");
}
