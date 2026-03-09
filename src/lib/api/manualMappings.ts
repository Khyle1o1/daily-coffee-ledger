import { supabase, handleSupabaseError } from "@/lib/supabaseClient";
import { normalizeText } from "@/utils/normalize";
import { normalizeOption } from "@/utils/defaultMapping";
import { requireAdminUser, requireAuthUser } from "@/lib/api/authGuards";
import type { Category } from "@/utils/types";

// ─── Domain type ──────────────────────────────────────────────────────────────

export interface ManualMapping {
  id: string;
  sourceCategory: string;
  sourceItem: string;
  sourceOption: string;
  mappedCategory: Category;
  mappedItemName: string;
  priority: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveManualMappingPayload {
  sourceCategory: string;
  sourceItem: string;
  sourceOption: string;
  mappedCategory: Category;
  mappedItemName: string;
  priority?: number;
  isActive?: boolean;
  notes?: string;
}

export interface ListManualMappingsParams {
  q?: string;
  mappedCategory?: Category | "ALL";
  activeOnly?: boolean;
  page?: number;
  pageSize?: number;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

type DbRow = {
  id: string;
  source_category: string;
  source_item: string;
  source_option: string;
  mapped_category: string;
  mapped_item_name: string;
  priority: number;
  is_active: boolean;
  notes: string | null;
  source_cat_norm: string;
  source_item_norm: string;
  source_opt_norm: string;
  created_at: string;
  updated_at: string;
};

function fromRow(row: DbRow): ManualMapping {
  return {
    id: row.id,
    sourceCategory: row.source_category,
    sourceItem: row.source_item,
    sourceOption: row.source_option,
    mappedCategory: row.mapped_category as Category,
    mappedItemName: row.mapped_item_name,
    priority: row.priority,
    isActive: row.is_active,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normFields(payload: Pick<SaveManualMappingPayload, "sourceCategory" | "sourceItem" | "sourceOption">) {
  return {
    source_cat_norm: normalizeText(payload.sourceCategory),
    source_item_norm: normalizeText(payload.sourceItem),
    source_opt_norm: normalizeOption(payload.sourceOption),
  };
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function listManualMappings(
  params: ListManualMappingsParams = {},
): Promise<{ items: ManualMapping[]; total: number }> {
  await requireAuthUser();

  const { q, mappedCategory, activeOnly, page = 1, pageSize = 50 } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = (supabase as any)
    .from("manual_mappings")
    .select("*", { count: "exact" })
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  if (mappedCategory && mappedCategory !== "ALL") {
    query = query.eq("mapped_category", mappedCategory);
  }

  if (q && q.trim()) {
    const term = q.trim();
    query = query.or(
      `source_item.ilike.%${term}%,source_category.ilike.%${term}%,mapped_item_name.ilike.%${term}%,notes.ilike.%${term}%`,
    );
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to list manual mappings: ${error.message}`);

  const rows = (data as DbRow[]) ?? [];
  return { items: rows.map(fromRow), total: count ?? rows.length };
}

export async function fetchActiveManualMappings(): Promise<ManualMapping[]> {
  await requireAuthUser();

  const { data, error } = await (supabase as any)
    .from("manual_mappings")
    .select("*")
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    // If table doesn't exist yet (migration not run), return empty gracefully
    if (error.code === "42P01") return [];
    throw new Error(`Failed to fetch active manual mappings: ${error.message}`);
  }

  return ((data as DbRow[]) ?? []).map(fromRow);
}

export async function createManualMapping(
  payload: SaveManualMappingPayload,
): Promise<ManualMapping> {
  await requireAdminUser();

  const sourceItem = payload.sourceItem.trim();
  if (!sourceItem) throw new Error("Source Item is required");
  if (!payload.mappedCategory) throw new Error("Mapped Category is required");
  if (!payload.mappedItemName.trim()) throw new Error("Mapped Item Name is required");

  const norms = normFields(payload);

  if (payload.isActive !== false) {
    const dup = await (supabase as any)
      .from("manual_mappings")
      .select("id")
      .eq("source_cat_norm", norms.source_cat_norm)
      .eq("source_item_norm", norms.source_item_norm)
      .eq("source_opt_norm", norms.source_opt_norm)
      .eq("is_active", true)
      .maybeSingle();

    if (dup.data) {
      throw new Error(
        "An active mapping already exists for this Category + Item + Option combination.",
      );
    }
  }

  const { data, error } = await (supabase as any)
    .from("manual_mappings")
    .insert({
      source_category: payload.sourceCategory.trim(),
      source_item: sourceItem,
      source_option: payload.sourceOption?.trim() ?? "",
      mapped_category: payload.mappedCategory,
      mapped_item_name: payload.mappedItemName.trim(),
      priority: payload.priority ?? 0,
      is_active: payload.isActive ?? true,
      notes: payload.notes?.trim() || null,
      ...norms,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create manual mapping: ${error.message}`);
  return fromRow(data as DbRow);
}

export async function updateManualMapping(
  id: string,
  payload: SaveManualMappingPayload,
): Promise<ManualMapping> {
  await requireAdminUser();

  const sourceItem = payload.sourceItem.trim();
  if (!sourceItem) throw new Error("Source Item is required");
  if (!payload.mappedCategory) throw new Error("Mapped Category is required");
  if (!payload.mappedItemName.trim()) throw new Error("Mapped Item Name is required");

  const norms = normFields(payload);

  if (payload.isActive !== false) {
    const dup = await (supabase as any)
      .from("manual_mappings")
      .select("id")
      .eq("source_cat_norm", norms.source_cat_norm)
      .eq("source_item_norm", norms.source_item_norm)
      .eq("source_opt_norm", norms.source_opt_norm)
      .eq("is_active", true)
      .neq("id", id)
      .maybeSingle();

    if (dup.data) {
      throw new Error(
        "Another active mapping already exists for this Category + Item + Option combination.",
      );
    }
  }

  const { data, error } = await (supabase as any)
    .from("manual_mappings")
    .update({
      source_category: payload.sourceCategory.trim(),
      source_item: sourceItem,
      source_option: payload.sourceOption?.trim() ?? "",
      mapped_category: payload.mappedCategory,
      mapped_item_name: payload.mappedItemName.trim(),
      priority: payload.priority ?? 0,
      is_active: payload.isActive ?? true,
      notes: payload.notes?.trim() || null,
      updated_at: new Date().toISOString(),
      ...norms,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to update manual mapping: ${error.message}`);
  return fromRow(data as DbRow);
}

export async function toggleManualMappingActive(
  id: string,
  isActive: boolean,
): Promise<ManualMapping> {
  await requireAdminUser();

  if (isActive) {
    const existing = await (supabase as any)
      .from("manual_mappings")
      .select("source_cat_norm, source_item_norm, source_opt_norm")
      .eq("id", id)
      .single();

    if (existing.error) throw new Error("Mapping not found");

    const { source_cat_norm, source_item_norm, source_opt_norm } = existing.data;

    const dup = await (supabase as any)
      .from("manual_mappings")
      .select("id")
      .eq("source_cat_norm", source_cat_norm)
      .eq("source_item_norm", source_item_norm)
      .eq("source_opt_norm", source_opt_norm)
      .eq("is_active", true)
      .neq("id", id)
      .maybeSingle();

    if (dup.data) {
      throw new Error(
        "Cannot activate: another active mapping already exists for the same source combination.",
      );
    }
  }

  const { data, error } = await (supabase as any)
    .from("manual_mappings")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to toggle mapping: ${error.message}`);
  return fromRow(data as DbRow);
}

export async function deleteManualMapping(id: string): Promise<void> {
  await requireAdminUser();
  const { error } = await (supabase as any).from("manual_mappings").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete manual mapping: ${error.message}`);
}
