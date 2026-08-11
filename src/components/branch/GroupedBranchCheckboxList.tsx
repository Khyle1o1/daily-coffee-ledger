import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  groupBranchesByCategory,
  type BranchCategory,
} from "@/lib/branchCategory";

export function GroupedBranchCheckboxList<T extends { category?: BranchCategory }>({
  options,
  selectedIds,
  getItemId,
  onToggleGroup,
  renderItem,
}: {
  options: T[];
  selectedIds: string[];
  getItemId: (item: T) => string;
  onToggleGroup: (ids: string[], select: boolean) => void;
  renderItem: (item: T) => ReactNode;
}) {
  return (
    <>
      {groupBranchesByCategory(options).map((group) => {
        const ids = group.items.map(getItemId);
        const selectedCount = ids.filter((id) => selectedIds.includes(id)).length;
        const allSelected = ids.length > 0 && selectedCount === ids.length;
        const someSelected = selectedCount > 0 && !allSelected;

        return (
          <div key={group.category}>
            <div className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-muted/40">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={(checked) => onToggleGroup(ids, checked === true)}
              />
              <button
                type="button"
                className="flex-1 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                onClick={() => onToggleGroup(ids, !allSelected)}
              >
                All {group.label}
              </button>
            </div>
            {group.items.map(renderItem)}
          </div>
        );
      })}
    </>
  );
}
