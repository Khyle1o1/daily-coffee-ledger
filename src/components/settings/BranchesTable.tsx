import { Pencil, MapPin, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import type { Branch } from '@/types/branch';

interface BranchesTableProps {
  branches: Branch[];
  loading: boolean;
  total: number;
  onEdit: (branch: Branch) => void;
  onAdd: () => void;
}

export function BranchesTable({
  branches,
  loading,
  total,
  onEdit,
  onAdd,
}: BranchesTableProps) {
  if (loading) {
    return (
      <Card className="rounded-3xl shadow-xl p-8">
        <div className="text-center py-12">
          <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading branches…</p>
        </div>
      </Card>
    );
  }

  if (!branches.length) {
    return (
      <Card className="rounded-3xl shadow-xl p-8">
        <div className="text-center py-12">
          <MapPin className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-xl font-semibold text-card-foreground mb-2">No branches yet</p>
          <p className="text-muted-foreground mb-6">
            Get started by adding your first branch.
          </p>
          <Button className="rounded-full" onClick={onAdd}>
            + Add Branch
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl shadow-xl p-4 sm:p-6">
      <div className="space-y-3">
        {branches.map((branch) => (
          <div
            key={branch.id}
            className="flex items-start justify-between p-4 border border-border rounded-2xl hover:bg-muted/50 transition-colors gap-4 flex-wrap"
          >
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="bg-primary/10 rounded-xl p-3 shrink-0 mt-0.5">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className="font-mono text-xs uppercase tracking-wide bg-background"
                  >
                    {branch.code}
                  </Badge>
                  <span className="font-semibold text-card-foreground text-sm sm:text-base">
                    {branch.name}
                  </span>
                  <Badge
                    variant={branch.isActive ? 'default' : 'secondary'}
                    className="text-[11px]"
                  >
                    {branch.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                {branch.address && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {branch.address}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Updated {format(new Date(branch.updatedAt), 'MMM dd, yyyy')}
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => onEdit(branch)}
              >
                <Pencil className="h-4 w-4 mr-1.5" />
                Edit
              </Button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-4 text-right">
        {total} branch{total !== 1 ? 'es' : ''} total
      </p>
    </Card>
  );
}

