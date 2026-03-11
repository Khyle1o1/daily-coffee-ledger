import { useCallback, useEffect, useState } from 'react';
import { Settings as SettingsIcon, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/auth/useAuth';
import { useNavigate } from 'react-router-dom';
import type { Branch } from '@/types/branch';
import { BranchesTable } from '@/components/settings/BranchesTable';
import { BranchModal } from '@/components/settings/BranchModal';
import { MappingManagementSection } from '@/components/settings/MappingManagementSection';
import { listBranches, createBranch, updateBranch } from '@/lib/api/branches';
import { useManualMappings } from '@/hooks/useManualMappings';
import { useInvalidateBranches } from '@/hooks/useLiveBranches';

export default function SettingsPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();
  const invalidateBranches = useInvalidateBranches();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [total, setTotal] = useState(0);
  const [branchesLoading, setBranchesLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);

  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  const { manualEntries, refetch: refetchManual } = useManualMappings();

  const loadBranches = useCallback(async () => {
    try {
      setBranchesLoading(true);
      const result = await listBranches({
        q: search || undefined,
        active: activeOnly ? true : undefined,
      });
      setBranches(result.items);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to load branches:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to load branches',
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setBranchesLoading(false);
    }
  }, [search, activeOnly, toast]);

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
    if (isAdmin) {
      void loadBranches();
    }
  }, [isAdmin, loadBranches]);

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
      await loadBranches();
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
    <div className="max-w-[1600px] mx-auto px-8 py-8">
      <Card className="rounded-3xl shadow-xl p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-2 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 rounded-2xl p-4">
              <SettingsIcon className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-card-foreground">Settings</h2>
              <p className="text-muted-foreground">
                Configure system preferences and branches.
              </p>
            </div>
          </div>
        </div>

        {/* Branches section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase mb-1">
                Branches
              </p>
              <h3 className="text-lg font-semibold text-card-foreground">
                Branch management
              </h3>
            </div>
            <Button
              onClick={openAddBranch}
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              + Add Branch
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-foreground/80 pointer-events-none" />
              <Input
                placeholder="Search branch…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-full pl-9 bg-primary text-primary-foreground placeholder:text-primary-foreground/80 border-transparent shadow-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="branches-active-only"
                checked={activeOnly}
                onCheckedChange={setActiveOnly}
              />
              <Label
                htmlFor="branches-active-only"
                className="text-sm cursor-pointer select-none text-card-foreground"
              >
                Active only
              </Label>
            </div>
          </div>

          <BranchesTable
            branches={branches}
            loading={branchesLoading}
            total={total}
            onEdit={openEditBranch}
            onAdd={openAddBranch}
          />
        </section>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Mapping Management section */}
        <MappingManagementSection
          manualEntries={manualEntries}
          onMappingsChanged={refetchManual}
        />
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

