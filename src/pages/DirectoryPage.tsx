import { useState, useEffect, useCallback } from 'react';
import {
  Link2,
  Plus,
  Shield,
  Loader2,
  ExternalLink,
  Pencil,
  Trash2,
  Copy,
  Search,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/auth/useAuth';
import { useNavigate } from 'react-router-dom';
import {
  listDirectoryLinks,
  createDirectoryLink,
  updateDirectoryLink,
  deleteDirectoryLink,
  getDirectoryCategories,
} from '@/services/directoryLinksService';
import DirectoryModal from '@/components/directory/DirectoryModal';
import DeleteDirectoryModal from '@/components/directory/DeleteDirectoryModal';
import type { DirectoryLink, CreateDirectoryLinkPayload } from '@/lib/supabase-types';
import { format } from 'date-fns';

export default function DirectoryPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();

  const [links, setLinks] = useState<DirectoryLink[]>([]);
  const [total, setTotal] = useState(0);
  const [linksLoading, setLinksLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);

  // Modals
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editingLink, setEditingLink] = useState<DirectoryLink | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingLink, setDeletingLink] = useState<DirectoryLink | null>(null);

  // Copy state per link id
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    try {
      setLinksLoading(true);
      const result = await listDirectoryLinks({
        q: search || undefined,
        category: categoryFilter || undefined,
        active: activeOnly ? true : undefined,
        sort: 'updatedAt',
        order: 'desc',
      });
      setLinks(result.items);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to load directory links:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to load links',
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setLinksLoading(false);
    }
  }, [search, categoryFilter, activeOnly, toast]);

  const loadCategories = useCallback(async () => {
    const cats = await getDirectoryCategories();
    setCategories(cats);
  }, []);

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Access denied',
        description: 'You must be an administrator to access Directory.',
      });
      navigate('/app/summary', { replace: true });
    }
  }, [loading, isAdmin, navigate, toast]);

  useEffect(() => {
    if (isAdmin) {
      loadLinks();
    }
  }, [isAdmin, loadLinks]);

  useEffect(() => {
    if (isAdmin) {
      loadCategories();
    }
  }, [isAdmin, loadCategories]);

  const handleSave = async (payload: CreateDirectoryLinkPayload) => {
    try {
      if (editingLink) {
        await updateDirectoryLink(editingLink.id, payload);
        toast({ title: 'Link saved', description: `"${payload.name}" has been updated.` });
      } else {
        await createDirectoryLink(payload);
        toast({ title: 'Link saved', description: `"${payload.name}" has been added.` });
      }
      setShowLinkModal(false);
      setEditingLink(null);
      await loadLinks();
      await loadCategories();
    } catch (error) {
      console.error('Failed to save link:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to save link',
        description: error instanceof Error ? error.message : 'An error occurred',
      });
      throw error;
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDirectoryLink(id);
      toast({ title: 'Link deleted' });
      setShowDeleteModal(false);
      setDeletingLink(null);
      await loadLinks();
      await loadCategories();
    } catch (error) {
      console.error('Failed to delete link:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to delete link',
        description: error instanceof Error ? error.message : 'An error occurred',
      });
      throw error;
    }
  };

  const handleCopy = async (link: DirectoryLink) => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedId(link.id);
      toast({ title: 'Copied', description: 'URL copied to clipboard.' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
  };

  const openEdit = (link: DirectoryLink) => {
    setEditingLink(link);
    setShowLinkModal(true);
  };

  const openDelete = (link: DirectoryLink) => {
    setDeletingLink(link);
    setShowDeleteModal(true);
  };

  if (loading || !isAdmin) {
    return null;
  }

  return (
    <div className="max-w-[1600px] mx-auto px-8 py-8">
      <Card className="rounded-3xl shadow-xl p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 rounded-2xl p-4">
              <Link2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-card-foreground">Directory</h2>
              <p className="text-muted-foreground">Manage redirect links and quick resources.</p>
            </div>
          </div>
          <Button
            onClick={() => {
              setEditingLink(null);
              setShowLinkModal(true);
            }}
            className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Link
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-foreground/90 pointer-events-none" />
            <Input
              placeholder="Search links…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-full pl-9 bg-primary text-primary-foreground placeholder:text-primary-foreground/80 border-transparent shadow-sm"
            />
          </div>

          <Select
            value={categoryFilter || '__all__'}
            onValueChange={(v) => setCategoryFilter(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="w-[200px] rounded-full bg-primary text-primary-foreground border-transparent shadow-sm">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Switch
              id="active-only"
              checked={activeOnly}
              onCheckedChange={setActiveOnly}
            />
            <Label
              htmlFor="active-only"
              className="text-sm cursor-pointer select-none text-card-foreground"
            >
              Active only
            </Label>
          </div>
        </div>

        {/* Table / List */}
        {linksLoading ? (
          <div className="text-center py-16">
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading links…</p>
          </div>
        ) : links.length === 0 ? (
          <div className="text-center py-16">
            <Link2 className="h-20 w-20 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-xl font-semibold text-card-foreground mb-2">No links found</p>
            <p className="text-muted-foreground mb-6">
              {search || categoryFilter || activeOnly
                ? 'Try adjusting your filters.'
                : 'Add your first directory link.'}
            </p>
            {!search && !categoryFilter && !activeOnly && (
              <Button
                onClick={() => {
                  setEditingLink(null);
                  setShowLinkModal(true);
                }}
                className="rounded-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Link
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {links.map((link) => (
                <LinkRow
                  key={link.id}
                  link={link}
                  copiedId={copiedId}
                  onCopy={handleCopy}
                  onEdit={openEdit}
                  onDelete={openDelete}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4 text-right">
              {total} link{total !== 1 ? 's' : ''} total
            </p>
          </>
        )}
      </Card>

      {/* Add / Edit Modal */}
      <DirectoryModal
        open={showLinkModal}
        onOpenChange={(open) => {
          setShowLinkModal(open);
          if (!open) setEditingLink(null);
        }}
        link={editingLink}
        onSave={handleSave}
      />

      {/* Delete Modal */}
      <DeleteDirectoryModal
        open={showDeleteModal}
        onOpenChange={(open) => {
          setShowDeleteModal(open);
          if (!open) setDeletingLink(null);
        }}
        link={deletingLink}
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ============================================================================
// LINK ROW SUB-COMPONENT
// ============================================================================

interface LinkRowProps {
  link: DirectoryLink;
  copiedId: string | null;
  onCopy: (link: DirectoryLink) => void;
  onEdit: (link: DirectoryLink) => void;
  onDelete: (link: DirectoryLink) => void;
}

function LinkRow({ link, copiedId, onCopy, onEdit, onDelete }: LinkRowProps) {
  const isCopied = copiedId === link.id;

  return (
    <div className="flex items-start justify-between p-4 border border-border rounded-2xl hover:bg-muted/50 transition-colors gap-4 flex-wrap">
      {/* Left: info */}
      <div className="flex items-start gap-4 flex-1 min-w-0">
        <div className="bg-primary/10 rounded-xl p-3 shrink-0 mt-0.5">
          <Link2 className="h-5 w-5 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-card-foreground">{link.name}</span>
            {link.category && (
              <Badge variant="outline" className="text-xs">
                {link.category}
              </Badge>
            )}
            <Badge
              variant={link.is_active ? 'default' : 'secondary'}
              className="text-xs"
            >
              {link.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>

          {link.description && (
            <p className="text-sm text-muted-foreground mb-1 line-clamp-1">
              {link.description}
            </p>
          )}

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline truncate max-w-[300px] block"
                >
                  {link.url}
                </a>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[400px] break-all">
                {link.url}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onCopy(link)}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  aria-label="Copy URL"
                >
                  {isCopied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>{isCopied ? 'Copied!' : 'Copy URL'}</TooltipContent>
            </Tooltip>
          </div>

          <p className="text-xs text-muted-foreground mt-1">
            Updated {format(new Date(link.updated_at), 'MMM dd, yyyy')}
          </p>
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              asChild
            >
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open link</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => onEdit(link)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(link)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
