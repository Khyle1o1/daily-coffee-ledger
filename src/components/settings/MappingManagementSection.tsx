import { useCallback, useEffect, useState } from "react";
import {
  Search,
  Layers,
  Pencil,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
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

const PAGE_SIZE = 10;

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

function pageNumbers(current: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, totalPages, current, current - 1, current + 1]);
  const sorted = [...pages].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);

  const result: (number | "ellipsis")[] = [];
  for (const n of sorted) {
    const prev = result[result.length - 1];
    if (typeof prev === "number" && n - prev > 1) {
      result.push("ellipsis");
    }
    result.push(n);
  }
  return result;
}

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
  const debouncedSearch = useDebouncedValue(search, 350);
  const [catFilter, setCatFilter] = useState<Category | "ALL">("ALL");
  const [activeOnly, setActiveOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ManualMapping | null>(null);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManualMapping | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listManualMappings({
        q: debouncedSearch || undefined,
        mappedCategory: catFilter,
        activeOnly,
        page: currentPage,
        pageSize: PAGE_SIZE,
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
  }, [debouncedSearch, catFilter, activeOnly, currentPage, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, catFilter, activeOnly]);

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

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-foreground/80 pointer-events-none" />
          <Input
            placeholder="Search item, category, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-full pl-9 bg-primary text-primary-foreground placeholder:text-primary-foreground/80 border-transparent shadow-sm"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap shrink-0">
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
              className="text-sm font-medium cursor-pointer select-none text-card-foreground whitespace-nowrap"
            >
              Active only
            </Label>
          </div>

          <Button
            onClick={openAdd}
            className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            + Add Mapping
          </Button>
        </div>
      </div>

      <MappingList
        mappings={mappings}
        total={total}
        loading={loading}
        page={currentPage}
        pageSize={PAGE_SIZE}
        togglingId={togglingId}
        hasFilters={Boolean(debouncedSearch) || catFilter !== "ALL" || activeOnly}
        onPageChange={setPage}
        onAdd={openAdd}
        onEdit={openEdit}
        onToggle={handleToggle}
        onDelete={setDeleteTarget}
      />

      <MappingTestPanel manualEntries={manualEntries} />

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

interface MappingListProps {
  mappings: ManualMapping[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  togglingId: string | null;
  hasFilters: boolean;
  onPageChange: (page: number) => void;
  onAdd: () => void;
  onEdit: (m: ManualMapping) => void;
  onToggle: (m: ManualMapping) => void;
  onDelete: (m: ManualMapping) => void;
}

function MappingList({
  mappings,
  total,
  loading,
  page,
  pageSize,
  togglingId,
  hasFilters,
  onPageChange,
  onAdd,
  onEdit,
  onToggle,
  onDelete,
}: MappingListProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden">
        {loading ? (
          <div className="text-center py-14">
            <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading mappings…</p>
          </div>
        ) : !mappings.length ? (
          <div className="text-center py-14 px-6">
            <div className="bg-primary/10 rounded-xl p-3 w-fit mx-auto mb-3">
              <Layers className="h-7 w-7 text-primary" />
            </div>
            <p className="text-base font-semibold text-card-foreground mb-1">
              {hasFilters ? "No matching mappings" : "No override mappings"}
            </p>
            <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
              {hasFilters
                ? "Try adjusting your search or filters."
                : "The built-in validation table handles most transactions. Add overrides here when you need to fix specific unmapped or mis-categorised rows."}
            </p>
            {!hasFilters && (
              <Button className="rounded-full" onClick={onAdd}>+ Add Mapping</Button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border/70">
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
          </ul>
        )}
      </div>

      {!loading && total > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap px-1">
          <p className="text-sm text-muted-foreground">
            Showing {from}–{to} of {total} {total === 1 ? "mapping" : "mappings"}
          </p>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full h-8 w-8 p-0"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {pageNumbers(page, totalPages).map((item, index) =>
                item === "ellipsis" ? (
                  <span
                    key={`ellipsis-${index}`}
                    className="w-8 text-center text-sm text-muted-foreground"
                  >
                    …
                  </span>
                ) : (
                  <Button
                    key={item}
                    variant={item === page ? "default" : "outline"}
                    size="sm"
                    className="rounded-full h-8 w-8 p-0"
                    onClick={() => onPageChange(item)}
                    aria-current={item === page ? "page" : undefined}
                    aria-label={`Page ${item}`}
                  >
                    {item}
                  </Button>
                ),
              )}

              <Button
                variant="outline"
                size="sm"
                className="rounded-full h-8 w-8 p-0"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  const detailParts = [
    m.sourceCategory || null,
    m.sourceOption || null,
    m.mappedItemName && m.mappedItemName !== m.sourceItem ? m.mappedItemName : null,
    m.notes,
  ].filter(Boolean);

  return (
    <li>
      <div className="flex items-center gap-3 px-4 h-16 sm:h-[68px] hover:bg-muted/40 transition-colors">
        <div className="relative shrink-0">
          <div className="bg-primary/10 rounded-lg p-1.5">
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-card",
              CATEGORY_DOT[m.mappedCategory] ?? "bg-slate-400",
            )}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm text-card-foreground truncate">
              {m.sourceItem}
            </span>
            <span
              className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
                CATEGORY_BADGE[m.mappedCategory] ?? "bg-muted text-card-foreground",
              )}
            >
              {m.mappedCategory}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {detailParts.length > 0 && (
              <>
                {detailParts.join(" · ")}
                <span className="mx-1.5 text-border">·</span>
              </>
            )}
            Updated {format(new Date(m.updatedAt), "MMM d, yyyy")}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onToggle(m)}
          disabled={toggling}
          aria-label={m.isActive ? "Deactivate mapping" : "Activate mapping"}
          className={cn(
            "inline-flex items-center gap-1.5 shrink-0 text-xs font-medium min-w-[4.75rem] rounded-full px-1 py-1 -mx-1 hover:bg-muted/60 transition-colors disabled:opacity-50",
            m.isActive
              ? "text-[hsl(var(--badge-mapped))]"
              : "text-muted-foreground",
          )}
        >
          {toggling ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                m.isActive
                  ? "bg-[hsl(var(--badge-mapped))]"
                  : "bg-muted-foreground/45",
              )}
            />
          )}
          {m.isActive ? "Active" : "Inactive"}
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            className="rounded-full h-8 px-3"
            onClick={() => onEdit(m)}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Edit</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
            onClick={() => onDelete(m)}
            title="Delete mapping"
            aria-label="Delete mapping"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </li>
  );
}
