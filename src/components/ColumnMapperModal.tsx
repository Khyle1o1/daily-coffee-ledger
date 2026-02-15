import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ColumnMapping } from "@/utils/types";

interface Props {
  open: boolean;
  headers: string[];
  autoDetected: Partial<Record<string, string>>;
  onConfirm: (mapping: ColumnMapping) => void;
  onCancel: () => void;
}

const FIELDS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: "rawCategory", label: "Category", required: true },
  { key: "rawItemName", label: "Item Name", required: true },
  { key: "option", label: "Option / Modifier", required: false },
  { key: "quantity", label: "Quantity", required: true },
  { key: "unitPrice", label: "Unit Price", required: true },
];

export default function ColumnMapperModal({ open, headers, autoDetected, onConfirm, onCancel }: Props) {
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});

  useEffect(() => {
    setMapping(autoDetected as Partial<ColumnMapping>);
  }, [autoDetected]);

  const isComplete = FIELDS.every(f => !f.required || mapping[f.key]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onCancel()}>
      <DialogContent className="max-w-lg rounded-3xl p-8">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-card-foreground">Map CSV Columns</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Select which CSV column corresponds to each required field.
          </p>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {FIELDS.map(f => (
            <div key={f.key} className="flex items-center gap-4">
              <label className="text-sm font-semibold w-32 shrink-0 text-card-foreground">
                {f.label}{f.required && <span className="text-primary ml-1">*</span>}
              </label>
              <Select
                value={mapping[f.key] || ""}
                onValueChange={v => setMapping(prev => ({ ...prev, [f.key]: v }))}
              >
                <SelectTrigger className="h-10 text-sm rounded-xl border-2 focus:border-primary">
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {!f.required && <SelectItem value="__none__">(none)</SelectItem>}
                  {headers.map(h => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <DialogFooter className="gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="px-6 py-2.5 h-auto rounded-full border-2"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!isComplete}
            onClick={() => {
              onConfirm({
                rawCategory: mapping.rawCategory!,
                rawItemName: mapping.rawItemName!,
                option: mapping.option === "__none__" ? "" : (mapping.option || ""),
                quantity: mapping.quantity!,
                unitPrice: mapping.unitPrice!,
              });
            }}
            className="px-6 py-2.5 h-auto rounded-full bg-primary text-primary-foreground font-semibold shadow-lg"
          >
            Confirm Mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
