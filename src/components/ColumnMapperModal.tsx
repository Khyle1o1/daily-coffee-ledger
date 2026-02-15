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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Map CSV Columns</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Select which CSV column corresponds to each required field.
          </p>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {FIELDS.map(f => (
            <div key={f.key} className="flex items-center gap-3">
              <label className="text-sm font-medium w-28 shrink-0">
                {f.label}{f.required && <span className="text-primary ml-0.5">*</span>}
              </label>
              <Select
                value={mapping[f.key] || ""}
                onValueChange={v => setMapping(prev => ({ ...prev, [f.key]: v }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  {!f.required && <SelectItem value="__none__">(none)</SelectItem>}
                  {headers.map(h => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" disabled={!isComplete} onClick={() => {
            onConfirm({
              rawCategory: mapping.rawCategory!,
              rawItemName: mapping.rawItemName!,
              option: mapping.option === "__none__" ? "" : (mapping.option || ""),
              quantity: mapping.quantity!,
              unitPrice: mapping.unitPrice!,
            });
          }}>
            Confirm Mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
