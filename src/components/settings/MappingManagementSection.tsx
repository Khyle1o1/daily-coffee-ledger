import { useCallback, useEffect, useState } from "react";
import {
  Search,
  Layers,
  Pencil,
  Trash2,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { MappingModal } from "./MappingModal";
import { MappingTestPanel } from "./MappingTestPanel";
import {
  listManualMappings,
  createManualMapping,
  updateManualMapping,
  toggleManualMappingActive,
  deleteManualMapping,
  type ManualMapping,
  type SaveManualMappingPayload,
} from "@/lib/api/manualMappings";
import { CATEGORIES, type Category, type MappingEntry } from "@/utils/types";

// ─── Category colour maps ─────────────────────────────────────────────────────

const CATEGORY_DOT: Record<string, string> = {
  ICED:           "bg-blue-500",
  HOT:            "bg-orange-500",
  SNACKS:         "bg-purple-500",
  "ADD-ONS":      "bg-amber-500",
  MERCH:          "bg-pink-500",
  PROMO:          "bg-lime-500",
  "LOYALTY CARD": "bg-red-500",
  PACKAGING:      "bg-slate-400",
};

const CATEGORY_BADGE: Record<string, string> = {
  ICED:           "bg-blue-100 text-blue-800",
  HOT:            "bg-orange-100 text-orange-800",
  SNACKS:         "bg-purple-100 text-purple-800",
  "ADD-ONS":      "bg-amber-100 text-amber-800",
  MERCH:          "bg-pink-100 text-pink-800",
  PROMO:          "bg-lime-100 text-lime-800",
  "LOYALTY CARD": "bg-red-100 text-red-800",
  PACKAGING:      "bg-slate-100 text-slate-700",
};

// ─── Section component ────────────────────────────────────────────────────────

interface MappingManagementSectionProps {
  manualEntries: MappingEntry[];
  onMappingsChanged: () => void;
}

export function MappingManagementSection({
  manualEntries,
  onMappingsChanged,
}: MappingManagementSectionProps) {
  const { toast } = useToast();

  const [mappings, setMappings] = useState<ManualMapping[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<Category | "ALL">("ALL");
  const [activeOnly, setActiveOnly] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ManualMapping | null>(null);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManualMapping | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listManualMappings({
        q: search || undefined,
        mappedCategory: catFilter,
        activeOnly,
        pageSize: 200,
      });
      setMappings(result.items);
      setTotal(result.total);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to load mappings",
        description: err instanceof Error ? err.message : "An error occurred",
      });
    } finally {
      setLoading(false);
    }
  }, [search, catFilter, activeOnly, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (payload: SaveManualMappingPayload) => {
    if (editing) {
      await updateManualMapping(editing.id, payload);
      toast({ title: "Mapping updated", description: `Override for "${payload.sourceItem}" saved.` });
    } else {
      await createManualMapping(payload);
      toast({ title: "Mapping added", description: `Override for "${payload.sourceItem}" created.` });
    }
    setShowModal(false);
    setEditing(null);
    await load();
    onMappingsChanged();
  };

  const handleToggle = async (m: ManualMapping) => {
    setTogglingId(m.id);
    try {
      await toggleManualMappingActive(m.id, !m.isActive);
      await load();
      onMappingsChanged();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to toggle",
        description: err instanceof Error ? err.message : "An error occurred",
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteManualMapping(deleteTarget.id);
      toast({ title: "Mapping deleted" });
      setDeleteTarget(null);
      await load();
      onMappingsChanged();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to delete",
        description: err instanceof Error ? err.message : "An error occurred",
      });
    } finally {
      setDeleting(false);
    }
  };

  const openAdd = () => { setEditing(null); setShowModal(true); };
  const openEdit = (m: ManualMapping) => { setEditing(m); setShowModal(true); };

  return (
    <section className="space-y-4">
      {/* ── Section header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase mb-1">
            Mapping Management
          </p>
          <h3 className="text-lg font-semibold text-card-foreground">
            Manual mapping overrides
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            These rules run{" "}
            <span className="font-semibold text-primary">before</span>{" "}
            the built-in validation table. Use them to fix unmapped or mis-categorised transactions.
          </p>
        </div>
        <Button
          onClick={openAdd}
          className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          + Add Mapping
        </Button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-foreground/80 pointer-events-none" />
          <Input
            placeholder="Search item, category, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-full pl-9 bg-primary text-primary-foreground placeholder:text-primary-foreground/80 border-transparent shadow-sm"
          />
        </div>

        <Select value={catFilter} onValueChange={(v) => setCatFilter(v as Category | "ALL")}>
          <SelectTrigger className="rounded-full w-[160px] text-sm bg-muted text-card-foreground border-border font-medium">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch id="mm-active-only" checked={activeOnly} onCheckedChange={setActiveOnly} />
          <Label
            htmlFor="mm-active-only"
            className="text-sm font-medium cursor-pointer select-none text-card-foreground"
          >
            Active only
          </Label>
        </div>
      </div>

      {/* ── List ── */}
      <MappingList
        mappings={mappings}
        total={total}
        loading={loading}
        togglingId={togglingId}
        onAdd={openAdd}
        onEdit={openEdit}
        onToggle={handleToggle}
        onDelete={setDeleteTarget}
      />

      {/* ── Test panel ── */}
      <MappingTestPanel manualEntries={manualEntries} />

      {/* ── Modals ── */}
      <MappingModal
        open={showModal}
        onOpenChange={(open) => { setShowModal(open); if (!open) setEditing(null); }}
        mapping={editing}
        onSave={handleSave}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-card-foreground">Delete mapping?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the override for{" "}
              <span className="font-semibold text-card-foreground">
                "{deleteTarget?.sourceItem}"
              </span>
              . The built-in validation table will continue to apply.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

// ─── MappingList ──────────────────────────────────────────────────────────────

interface MappingListProps {
  mappings: ManualMapping[];
  total: number;
  loading: boolean;
  togglingId: string | null;
  onAdd: () => void;
  onEdit: (m: ManualMapping) => void;
  onToggle: (m: ManualMapping) => void;
  onDelete: (m: ManualMapping) => void;
}

function MappingList({
  mappings,
  total,
  loading,
  togglingId,
  onAdd,
  onEdit,
  onToggle,
  onDelete,
}: MappingListProps) {
  if (loading) {
    return (
      <Card className="rounded-3xl shadow-xl p-8">
        <div className="text-center py-10">
          <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading mappings…</p>
        </div>
      </Card>
    );
  }

  if (!mappings.length) {
    return (
      <Card className="rounded-3xl shadow-xl p-8">
        <div className="text-center py-10">
          <Layers className="h-14 w-14 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-xl font-semibold text-card-foreground mb-2">No override mappings</p>
          <p className="text-muted-foreground mb-6 text-sm max-w-sm mx-auto">
            The built-in validation table handles most transactions. Add overrides here when you
            need to fix specific unmapped or mis-categorised rows.
          </p>
          <Button className="rounded-full" onClick={onAdd}>+ Add Mapping</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl shadow-xl p-4 sm:p-6">
      <div className="space-y-2">
        {mappings.map((m) => (
          <MappingRow
            key={m.id}
            mapping={m}
            toggling={togglingId === m.id}
            onEdit={onEdit}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-4 text-right">
        {total} override{total !== 1 ? "s" : ""} total
      </p>
    </Card>
  );
}

// ─── MappingRow ───────────────────────────────────────────────────────────────

function MappingRow({
  mapping: m,
  toggling,
  onEdit,
  onToggle,
  onDelete,
}: {
  mapping: ManualMapping;
  toggling: boolean;
  onEdit: (m: ManualMapping) => void;
  onToggle: (m: ManualMapping) => void;
  onDelete: (m: ManualMapping) => void;
}) {
  const hasMeta = m.priority !== 0 || !!m.notes;

  return (
    <div
      className={`flex items-center justify-between px-4 py-3.5 border rounded-2xl gap-4 transition-colors ${
        m.isActive
          ? "border-border bg-card hover:bg-muted/30"
          : "border-border/40 bg-muted/20 opacity-55"
      }`}
    >
      {/* ── Left: dot + content ── */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Category colour dot */}
        <div
          className={`h-3 w-3 rounded-full shrink-0 ${
            CATEGORY_DOT[m.mappedCategory] ?? "bg-slate-400"
          }`}
        />

        <div className="flex-1 min-w-0 space-y-1">
          {/* SOURCE line */}
          <div className="flex items-center flex-wrap gap-1.5">
            {m.sourceCategory && (
              <span className="text-[11px] font-mono font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-md uppercase tracking-wider">
                {m.sourceCategory}
              </span>
            )}
            {m.sourceCategory && (
              <span className="text-muted-foreground text-sm font-medium">›</span>
            )}
            <span className="text-sm font-semibold text-card-foreground">{m.sourceItem}</span>
            {m.sourceOption && (
              <span className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {m.sourceOption}
              </span>
            )}
          </div>

          {/* OUTPUT line */}
          <div className="flex items-center gap-2 flex-wrap">
            <ArrowRight className="h-3 w-3 text-primary shrink-0" />
            <span className="text-sm font-semibold text-card-foreground">{m.mappedItemName}</span>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                CATEGORY_BADGE[m.mappedCategory] ?? "bg-muted text-card-foreground"
              }`}
            >
              {m.mappedCategory}
            </span>
          </div>

          {/* META line — only rendered when there is something to show */}
          {hasMeta && (
            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              {m.priority !== 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono font-semibold rounded-full h-5 text-muted-foreground border-border"
                >
                  P{m.priority > 0 ? "+" : ""}{m.priority}
                </Badge>
              )}
              {m.notes && (
                <span className="text-xs text-muted-foreground italic truncate max-w-[260px]">
                  {m.notes}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: controls ── */}
      <div className="flex items-center gap-2 shrink-0">
        <Switch
          checked={m.isActive}
          onCheckedChange={() => onToggle(m)}
          disabled={toggling}
          aria-label={m.isActive ? "Deactivate mapping" : "Activate mapping"}
          className="scale-90"
        />
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl h-8 w-8 p-0 text-card-foreground hover:bg-muted"
          onClick={() => onEdit(m)}
          title="Edit mapping"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
          onClick={() => onDelete(m)}
          title="Delete mapping"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
