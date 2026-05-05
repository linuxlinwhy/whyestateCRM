import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";
import type { PhotoAnalysis } from "./prompts";

export interface PhotoBatch {
  id: string;
  user_email: string;
  name: string;
  created_at: string;
}

export interface PhotoVersion {
  label: string;
  source: "ai" | "edit";
  url: string;
}

export type ItemStatus = "queued" | "processing" | "done" | "error";

export interface PhotoBatchItem {
  id: string;
  batch_id: string;
  idx: number;
  filename: string;
  status: ItemStatus;
  status_label: string | null;
  error: string | null;
  analysis: PhotoAnalysis | null;
  original_w: number | null;
  original_h: number | null;
  fal_original_url: string | null;
  versions: PhotoVersion[];
  active_version: number;
  created_at: string;
  updated_at: string;
}

// ───────────────────────────────────────────────────────────── batches ──

export async function listBatches(userEmail: string): Promise<PhotoBatch[]> {
  const { data, error } = await supabase
    .from("photo_batches")
    .select("id, user_email, name, created_at")
    .eq("user_email", userEmail.toLowerCase())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createBatch(userEmail: string, name: string): Promise<PhotoBatch> {
  const { data, error } = await supabase
    .from("photo_batches")
    .insert({ user_email: userEmail.toLowerCase(), name })
    .select("id, user_email, name, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function renameBatch(id: string, name: string): Promise<void> {
  const { error } = await supabase.from("photo_batches").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteBatch(id: string): Promise<void> {
  const { error } = await supabase.from("photo_batches").delete().eq("id", id);
  if (error) throw error;
}

// ───────────────────────────────────────────────────────── batch items ──

export async function listBatchItems(batchId: string): Promise<PhotoBatchItem[]> {
  const { data, error } = await supabase
    .from("photo_batch_items")
    .select("*")
    .eq("batch_id", batchId)
    .order("idx", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PhotoBatchItem[];
}

export async function createBatchItem(
  batchId: string,
  idx: number,
  filename: string,
): Promise<PhotoBatchItem> {
  const { data, error } = await supabase
    .from("photo_batch_items")
    .insert({
      batch_id: batchId,
      idx,
      filename,
      status: "queued",
      status_label: "Queued",
      versions: [],
      active_version: -1,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as PhotoBatchItem;
}

export async function updateBatchItem(
  id: string,
  patch: Partial<
    Pick<
      PhotoBatchItem,
      | "status"
      | "status_label"
      | "error"
      | "analysis"
      | "original_w"
      | "original_h"
      | "fal_original_url"
      | "versions"
      | "active_version"
    >
  >,
): Promise<void> {
  // PhotoAnalysis / PhotoVersion[] both serialize to Json — cast through unknown.
  const { error } = await supabase
    .from("photo_batch_items")
    .update(patch as unknown as { [k: string]: Json | null })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteBatchItem(id: string): Promise<void> {
  const { error } = await supabase.from("photo_batch_items").delete().eq("id", id);
  if (error) throw error;
}
