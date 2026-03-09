import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ManualMapping, SaveManualMappingPayload } from "@/lib/api/manualMappings";
import { CATEGORIES, type Category } from "@/utils/types";

interface MappingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapping?: ManualMapping | null;
  onSave: (payload: SaveManualMappingPayload) => Promise<void>;
}

interface FormErrors {
  sourceItem?: string;
  mappedCategory?: string;
  mappedItemName?: string;
}

const DEFAULT_FORM = {
  sourceCategory: "",
  sourceItem: "",
  sourceOption: "",
  mappedCategory: "" as Category | "",
  mappedItemName: "",
  priority: 0,
  isActive: true,
  notes: "",
};

export function MappingModal({ open, onOpenChange, mapping, onSave }: MappingModalProps) {
  const isEditing = !!mapping;

  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (mapping) {
        setForm({
          sourceCategory: mapping.sourceCategory,
          sourceItem: mapping.sourceItem,
          sourceOption: mapping.sourceOption,
          mappedCategory: mapping.mappedCategory,
          mappedItemName: mapping.mappedItemName,
          priority: mapping.priority,
          isActive: mapping.isActive,
          notes: mapping.notes ?? "",
        });
      } else {
        setForm(DEFAULT_FORM);
      }
      setErrors({});
      setServerError(null);
    }
  }, [open, mapping]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.sourceItem.trim()) next.sourceItem = "Source Item is required";
    if (!form.mappedCategory) next.mappedCategory = "Mapped Category is required";
    if (!form.mappedItemName.trim()) next.mappedItemName = "Mapped Item Name is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    try {
      setSaving(true);
      await onSave({
        sourceCategory: form.sourceCategory.trim(),
        sourceItem: form.sourceItem.trim(),
        sourceOption: form.sourceOption.trim(),
        mappedCategory: form.mappedCategory as Category,
        mappedItemName: form.mappedItemName.trim(),
        priority: form.priority,
        isActive: form.isActive,
        notes: form.notes.trim() || undefined,
      });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to save mapping");
    } finally {
      setSaving(false);
    }
  };

  const isFormValid =
    form.sourceItem.trim().length > 0 &&
    !!form.mappedCategory &&
    form.mappedItemName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl bg-card text-card-foreground shadow-2xl max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">
            {isEditing ? "Edit Mapping" : "Add Manual Mapping"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isEditing
              ? "Update this override mapping. Changes take effect on the next CSV upload."
              : "Create an override that fires before the built-in validation table."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            {/* ── Source fields ── */}
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Match (source transaction fields)
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mm-src-cat">Source Category</Label>
                <Input
                  id="mm-src-cat"
                  placeholder="e.g. CLASSICS"
                  value={form.sourceCategory}
                  onChange={(e) => set("sourceCategory", e.target.value)}
                  className="rounded-xl bg-muted text-card-foreground placeholder:text-muted-foreground text-sm"
                  disabled={saving}
                />
                <p className="text-[11px] text-muted-foreground">Leave blank to match any.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mm-src-item">
                  Source Item <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="mm-src-item"
                  placeholder="e.g. Americano"
                  value={form.sourceItem}
                  onChange={(e) => set("sourceItem", e.target.value)}
                  className={`rounded-xl bg-muted text-card-foreground placeholder:text-muted-foreground text-sm ${
                    errors.sourceItem ? "border-destructive" : ""
                  }`}
                  disabled={saving}
                />
                {errors.sourceItem && (
                  <p className="text-xs text-destructive">{errors.sourceItem}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mm-src-opt">Source Option</Label>
              <Input
                id="mm-src-opt"
                placeholder="e.g. Iced Regular 12 oz. (empty = match blank option)"
                value={form.sourceOption}
                onChange={(e) => set("sourceOption", e.target.value)}
                className="rounded-xl bg-muted text-card-foreground placeholder:text-muted-foreground text-sm"
                disabled={saving}
              />
            </div>

            {/* ── Output fields ── */}
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase pt-1">
              Output (mapped result)
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mm-mapped-cat">
                  Mapped Category <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.mappedCategory}
                  onValueChange={(v) => set("mappedCategory", v as Category)}
                  disabled={saving}
                >
                  <SelectTrigger
                    id="mm-mapped-cat"
                    className={`rounded-xl bg-muted text-card-foreground text-sm ${
                      errors.mappedCategory ? "border-destructive" : ""
                    }`}
                  >
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.mappedCategory && (
                  <p className="text-xs text-destructive">{errors.mappedCategory}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mm-mapped-item">
                  Mapped Item Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="mm-mapped-item"
                  placeholder="e.g. Americano"
                  value={form.mappedItemName}
                  onChange={(e) => set("mappedItemName", e.target.value)}
                  className={`rounded-xl bg-muted text-card-foreground placeholder:text-muted-foreground text-sm ${
                    errors.mappedItemName ? "border-destructive" : ""
                  }`}
                  disabled={saving}
                />
                {errors.mappedItemName && (
                  <p className="text-xs text-destructive">{errors.mappedItemName}</p>
                )}
              </div>
            </div>

            {/* ── Control fields ── */}
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="mm-priority">Priority</Label>
                <Input
                  id="mm-priority"
                  type="number"
                  min={-999}
                  max={999}
                  value={form.priority}
                  onChange={(e) => set("priority", parseInt(e.target.value) || 0)}
                  className="rounded-xl bg-muted text-card-foreground text-sm"
                  disabled={saving}
                />
                <p className="text-[11px] text-muted-foreground">Higher = checked first.</p>
              </div>

              <div className="flex items-center justify-between py-2 px-1">
                <div>
                  <Label
                    htmlFor="mm-active"
                    className={`text-sm font-medium ${
                      form.isActive ? "text-card-foreground" : "text-muted-foreground"
                    }`}
                  >
                    Active
                  </Label>
                </div>
                <Switch
                  id="mm-active"
                  checked={form.isActive}
                  onCheckedChange={(v) => set("isActive", v)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mm-notes">Notes</Label>
              <Textarea
                id="mm-notes"
                placeholder="Optional notes for this override…"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                className="rounded-xl bg-muted text-card-foreground placeholder:text-muted-foreground text-sm resize-none"
                rows={2}
                disabled={saving}
              />
            </div>

            {serverError && (
              <p className="text-xs text-destructive rounded-lg bg-destructive/10 px-3 py-2">
                {serverError}
              </p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-xl"
              disabled={saving || !isFormValid}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : isEditing ? (
                "Save Changes"
              ) : (
                "Add Mapping"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
