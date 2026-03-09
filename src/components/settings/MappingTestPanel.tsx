import { useState } from "react";
import { FlaskConical, ArrowRight, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { mapRow } from "@/utils/mapRow";
import { DEFAULT_MAPPING, normalizeOption } from "@/utils/defaultMapping";
import { normalizeText } from "@/utils/normalize";
import { fetchActiveManualMappings } from "@/lib/api/manualMappings";
import type { MappingEntry, Category } from "@/utils/types";

interface TestResult {
  status: "MAPPED" | "UNMAPPED";
  mappedCat: Category | null;
  mappedItemName: string | null;
  source: "MANUAL" | "VALIDATION" | null;
}

interface MappingTestPanelProps {
  /** Live manual entries already loaded by the parent — avoids an extra fetch */
  manualEntries: MappingEntry[];
}

const BADGE_COLORS: Record<string, string> = {
  ICED:          "bg-blue-100 text-blue-700",
  HOT:           "bg-orange-100 text-orange-700",
  SNACKS:        "bg-purple-100 text-purple-700",
  "ADD-ONS":     "bg-amber-100 text-amber-700",
  MERCH:         "bg-pink-100 text-pink-700",
  PROMO:         "bg-lime-100 text-lime-700",
  "LOYALTY CARD":"bg-red-100 text-red-700",
  PACKAGING:     "bg-slate-100 text-slate-600",
};

export function MappingTestPanel({ manualEntries }: MappingTestPanelProps) {
  const [category, setCategory] = useState("");
  const [item, setItem] = useState("");
  const [option, setOption] = useState("");
  const [result, setResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const runTest = async () => {
    if (!item.trim()) return;
    setTesting(true);
    setResult(null);

    try {
      // Fetch fresh active manual mappings for the test
      let freshManual: MappingEntry[] = manualEntries;
      try {
        const raw = await fetchActiveManualMappings();
        freshManual = raw.map((m) => ({
          mappedName: m.mappedCategory,
          category:   m.sourceCategory,
          item:        m.sourceItem,
          option:      m.sourceOption,
          catNorm:     normalizeText(m.sourceCategory),
          itemNorm:    normalizeText(m.sourceItem),
          optionNorm:  normalizeOption(m.sourceOption),
          outputItem:  m.mappedItemName,
        }));
      } catch {
        // fall back to prop
      }

      const combinedTable = [...freshManual, ...DEFAULT_MAPPING];

      const processed = mapRow(
        {
          rawCategory: category,
          rawItemName: item,
          option: option,
          quantity: 1,
          unitPrice: 1,
        },
        combinedTable,
      );

      if (processed.status === "MAPPED") {
        // Determine source: was it from a manual entry?
        const catN = normalizeText(category);
        const itemN = normalizeText(item);
        const optN = normalizeOption(option);

        const isManual = freshManual.some(
          (e) => e.catNorm === catN && e.itemNorm === itemN && e.optionNorm === optN,
        );

        setResult({
          status: "MAPPED",
          mappedCat: processed.mappedCat,
          mappedItemName: processed.mappedItemName,
          source: isManual ? "MANUAL" : "VALIDATION",
        });
      } else {
        setResult({ status: "UNMAPPED", mappedCat: null, mappedItemName: null, source: null });
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="bg-primary/10 rounded-lg p-1.5 shrink-0">
          <FlaskConical className="h-4 w-4 text-primary" />
        </div>
        <div>
          <span className="text-sm font-semibold text-card-foreground">Test Mapping</span>
          <span className="text-xs text-muted-foreground ml-2">
            Preview what a transaction row resolves to
          </span>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="test-cat" className="text-xs font-medium text-card-foreground">
            Category
          </Label>
          <Input
            id="test-cat"
            placeholder="e.g. CLASSICS"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setResult(null); }}
            className="rounded-xl bg-muted text-card-foreground placeholder:text-muted-foreground text-sm h-9 border-border"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="test-item" className="text-xs font-medium text-card-foreground">
            Item <span className="text-destructive">*</span>
          </Label>
          <Input
            id="test-item"
            placeholder="e.g. Americano"
            value={item}
            onChange={(e) => { setItem(e.target.value); setResult(null); }}
            className="rounded-xl bg-muted text-card-foreground placeholder:text-muted-foreground text-sm h-9 border-border"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="test-opt" className="text-xs font-medium text-card-foreground">
            Option
          </Label>
          <Input
            id="test-opt"
            placeholder="e.g. Iced Regular 12 oz."
            value={option}
            onChange={(e) => { setOption(e.target.value); setResult(null); }}
            className="rounded-xl bg-muted text-card-foreground placeholder:text-muted-foreground text-sm h-9 border-border"
          />
        </div>
      </div>

      {/* Run + result */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          onClick={runTest}
          disabled={!item.trim() || testing}
          size="sm"
          className="rounded-full"
        >
          <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
          {testing ? "Testing…" : "Run Test"}
        </Button>

        {result && (
          <div className="flex items-center gap-2 flex-wrap">
            {result.status === "MAPPED" ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="text-sm font-semibold text-card-foreground">
                  {result.mappedItemName}
                </span>
                {result.mappedCat && (
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      BADGE_COLORS[result.mappedCat] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {result.mappedCat}
                  </span>
                )}
                <Badge
                  variant={result.source === "MANUAL" ? "default" : "secondary"}
                  className="text-[10px] rounded-full"
                >
                  {result.source === "MANUAL" ? "Manual override" : "Validation table"}
                </Badge>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-destructive shrink-0" />
                <span className="text-sm text-destructive font-semibold">UNMAPPED</span>
                <span className="text-xs text-muted-foreground">
                  No match in manual overrides or validation table.
                </span>
              </>
            )}
          </div>
        )}

        {!result && item.trim() && !testing && (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            Press Run Test to preview
          </span>
        )}
      </div>
    </div>
  );
}
