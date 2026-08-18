import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/auth/useAuth';
import { useNavigate } from 'react-router-dom';
import type { Branch } from '@/types/branch';
import type { BranchCategory } from '@/lib/branchCategory';
import { BranchesTable } from '@/components/settings/BranchesTable';
import { BranchModal } from '@/components/settings/BranchModal';
import { MappingManagementSection } from '@/components/settings/MappingManagementSection';
import { BackupRestoreSection } from '@/components/settings/BackupRestoreSection';
import { listBranches, createBranch, updateBranch } from '@/lib/api/branches';
import { useManualMappings } from '@/hooks/useManualMappings';
import { useInvalidateBranches } from '@/hooks/useLiveBranches';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { queryKeys } from '@/hooks/queries/queryKeys';

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();
  const invalidateBranches = useInvalidateBranches();

  const PAGE_SIZE = 10;
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [activeOnly, setActiveOnly] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<BranchCategory | 'all'>('all');
  const [page, setPage] = useState(1);

  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  const { manualEntries, refetch: refetchManual } = useManualMappings();

  const {
    data: branchesResult,
    isLoading: branchesLoading,
    error: branchesError,
  } = useQuery({
    queryKey: queryKeys.branches.adminList({
      q: debouncedSearch || undefined,
      active: activeOnly ? true : undefined,
    }),
    queryFn: () =>
      listBranches({
        q: debouncedSearch || undefined,
        active: activeOnly ? true : undefined,
      }),
    enabled: isAdmin,
  });

  const loadedBranches = (branchesResult?.items ?? []) as Branch[];
  const allBranches =
    categoryFilter === 'all'
      ? loadedBranches
      : loadedBranches.filter((branch) => branch.category === categoryFilter);
  const total = allBranches.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const branches = allBranches.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Access denied',
        description: 'You must be an administrator to access Settings.',
      });
      navigate('/app/summary', { replace: true });
    }
  }, [loading, isAdmin, navigate, toast]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeOnly, categoryFilter]);

  useEffect(() => {
    if (!branchesError) return;
    toast({
      variant: 'destructive',
      title: 'Failed to load branches',
      description: branchesError instanceof Error ? branchesError.message : 'An error occurred',
    });
  }, [branchesError, toast]);

  const handleSaveBranch = async (payload: {
    code: string;
    name: string;
    address?: string;
    isActive?: boolean;
  }) => {
    try {
      if (editingBranch) {
        const updated = await updateBranch(editingBranch.id, payload);
        toast({
          title: 'Branch saved',
          description: `"${updated.name}" has been updated.`,
        });
      } else {
        const created = await createBranch(payload);
        toast({
          title: 'Branch saved',
          description: `"${created.name}" has been added.`,
        });
      }
      setShowBranchModal(false);
      setEditingBranch(null);
      // Refresh both the Settings list and the shared cache used by all pages.
      invalidateBranches();
      void queryClient.invalidateQueries({
        queryKey: queryKeys.branches.adminList({
          q: debouncedSearch || undefined,
          active: activeOnly ? true : undefined,
        }),
      });
    } catch (error) {
      console.error('Failed to save branch:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to save branch',
        description: error instanceof Error ? error.message : 'An error occurred',
      });
      throw error;
    }
  };

  const openAddBranch = () => {
    setEditingBranch(null);
    setShowBranchModal(true);
  };

  const openEditBranch = (branch: Branch) => {
    setEditingBranch(branch);
    setShowBranchModal(true);
  };

  if (loading || !isAdmin) {
    return null;
  }

  return (
    <div className="w-full px-5 sm:px-8 lg:px-10 py-6">
      <Card className="p-6 sm:p-8 space-y-8">

        {/* Branches section */}
        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase mb-1">
              Branches
            </p>
            <h3 className="text-lg font-semibold text-card-foreground">
              Branch management
            </h3>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search branches…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-[10px] pl-9 bg-white"
              />
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Select
                value={categoryFilter}
                onValueChange={(value) => setCategoryFilter(value as BranchCategory | 'all')}
              >
                <SelectTrigger className="w-[160px] rounded-[10px] bg-white text-sm font-medium">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch
                  id="branches-active-only"
                  checked={activeOnly}
                  onCheckedChange={setActiveOnly}
                />
                <Label
                  htmlFor="branches-active-only"
                  className="text-sm cursor-pointer select-none text-card-foreground whitespace-nowrap"
                >
                  Active only
                </Label>
              </div>
              <Button
                onClick={openAddBranch}
                className="rounded-[10px]"
              >
                + Add Branch
              </Button>
            </div>
          </div>

          <BranchesTable
            branches={branches}
            loading={branchesLoading}
            total={total}
            page={currentPage}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            onEdit={openEditBranch}
            onAdd={openAddBranch}
            hasFilters={Boolean(debouncedSearch) || categoryFilter !== 'all'}
          />
        </section>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Mapping Management section */}
        <MappingManagementSection
          manualEntries={manualEntries}
          onMappingsChanged={refetchManual}
        />

        <div className="border-t border-border" />

        <BackupRestoreSection onRestored={refetchManual} />
      </Card>

      <BranchModal
        open={showBranchModal}
        onOpenChange={(open) => {
          setShowBranchModal(open);
          if (!open) setEditingBranch(null);
        }}
        branch={editingBranch}
        onSave={handleSaveBranch}
      />
    </div>
  );
}

