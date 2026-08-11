import { Pencil, Store, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Branch } from '@/types/branch';
import { branchCategoryLabel } from '@/lib/branchCategory';

interface BranchesTableProps {
  branches: Branch[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onEdit: (branch: Branch) => void;
  onAdd: () => void;
  hasFilters?: boolean;
}

function pageNumbers(current: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, totalPages, current, current - 1, current + 1]);
  const sorted = [...pages].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);

  const result: (number | 'ellipsis')[] = [];
  for (const n of sorted) {
    const prev = result[result.length - 1];
    if (typeof prev === 'number' && n - prev > 1) {
      result.push('ellipsis');
    }
    result.push(n);
  }
  return result;
}

export function BranchesTable({
  branches,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
  onEdit,
  onAdd,
  hasFilters = false,
}: BranchesTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden">
        {loading ? (
          <div className="text-center py-14">
            <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading branches…</p>
          </div>
        ) : !branches.length ? (
          <div className="text-center py-14 px-6">
            <div className="bg-primary/10 rounded-xl p-3 w-fit mx-auto mb-3">
              <Store className="h-7 w-7 text-primary" />
            </div>
            <p className="text-base font-semibold text-card-foreground mb-1">
              {hasFilters ? 'No matching branches' : 'No branches yet'}
            </p>
            <p className="text-sm text-muted-foreground mb-5">
              {hasFilters
                ? 'Try adjusting your search or filters.'
                : 'Get started by adding your first branch.'}
            </p>
            {!hasFilters && (
              <Button className="rounded-full" onClick={onAdd}>
                + Add Branch
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border/70">
            {branches.map((branch) => (
              <li key={branch.id}>
                <div className="flex items-center gap-3 px-4 h-16 sm:h-[68px] hover:bg-muted/40 transition-colors">
                  <div className="bg-primary/10 rounded-lg p-1.5 shrink-0">
                    <Store className="h-4 w-4 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-sm text-card-foreground truncate">
                        {branch.name}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
                          branch.category === 'external'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-teal-100 text-teal-800',
                        )}
                      >
                        {branchCategoryLabel(branch.category)}
                      </span>
                      <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground shrink-0">
                        {branch.code}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      Updated {format(new Date(branch.updatedAt), 'MMM d, yyyy')}
                    </p>
                  </div>

                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 shrink-0 text-xs font-medium min-w-[4.75rem]',
                      branch.isActive
                        ? 'text-[hsl(var(--badge-mapped))]'
                        : 'text-muted-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        branch.isActive
                          ? 'bg-[hsl(var(--badge-mapped))]'
                          : 'bg-muted-foreground/45',
                      )}
                    />
                    {branch.isActive ? 'Active' : 'Inactive'}
                  </span>

                  <Button
                    size="sm"
                    className="rounded-full h-8 px-3 shrink-0"
                    onClick={() => onEdit(branch)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!loading && total > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap px-1">
          <p className="text-sm text-muted-foreground">
            Showing {from}–{to} of {total} {total === 1 ? 'branch' : 'branches'}
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
                item === 'ellipsis' ? (
                  <span
                    key={`ellipsis-${index}`}
                    className="w-8 text-center text-sm text-muted-foreground"
                  >
                    …
                  </span>
                ) : (
                  <Button
                    key={item}
                    variant={item === page ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-full h-8 w-8 p-0"
                    onClick={() => onPageChange(item)}
                    aria-current={item === page ? 'page' : undefined}
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
