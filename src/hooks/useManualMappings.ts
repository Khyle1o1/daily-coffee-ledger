import { useEffect, useMemo, useState } from "react";
import { fetchActiveManualMappings, type ManualMapping } from "@/lib/api/manualMappings";
import { normalizeText } from "@/utils/normalize";
import { normalizeOption } from "@/utils/defaultMapping";
import type { MappingEntry } from "@/utils/types";

/**
 * Convert a ManualMapping record (from DB) into a MappingEntry compatible
 * with the existing mapRow() index.
 *
 * Key points:
 *  - `item`       = sourceItem  → used as the normalized lookup key
 *  - `outputItem` = mappedItemName → overrides the output (may differ from source)
 *  - Manual entries are prepended before the validation table, so they win
 *    whenever the same Category + Item + Option is hit.
 */
function toMappingEntry(m: ManualMapping): MappingEntry {
  return {
    mappedName: m.mappedCategory,
    category:   m.sourceCategory,
    item:        m.sourceItem,         // lookup key
    option:      m.sourceOption,
    catNorm:     normalizeText(m.sourceCategory),
    itemNorm:    normalizeText(m.sourceItem),
    optionNorm:  normalizeOption(m.sourceOption),
    outputItem:  m.mappedItemName,     // output override
  };
}

/**
 * Loads all active manual mappings from the database and converts them to
 * the `MappingEntry[]` format expected by `mapRow()`.
 *
 * Returns an empty array if the table doesn't exist yet (migration pending)
 * or if the user is unauthenticated, so it never breaks the pipeline.
 */
export function useManualMappings(): {
  manualEntries: MappingEntry[];
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const [raw, setRaw] = useState<ManualMapping[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const data = await fetchActiveManualMappings();
      setRaw(data);
    } catch {
      setRaw([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const manualEntries = useMemo(() => raw.map(toMappingEntry), [raw]);

  return { manualEntries, loading, refetch: load };
}
