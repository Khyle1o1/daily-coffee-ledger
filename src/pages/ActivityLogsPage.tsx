import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ScrollText, Search, ChevronLeft, ChevronRight,
  RefreshCw, LogIn, LogOut, Plus, Edit2, Trash2,
  BarChart3, Download, Users, Settings, GitBranch, Map, Eye,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/auth/useAuth';
import { listAuditLogs } from '@/services/auditService';
import { useLiveBranches } from '@/hooks/useLiveBranches';
import type { AuditLog, AuditAction, AuditModule } from '@/lib/supabase-types';
import { getRoleBadgeClass, getRoleLabel } from '@/lib/permissions';
import { format, parseISO } from 'date-fns';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<AuditAction, string> = {
  login:           'Logged In',
  logout:          'Logged Out',
  add_data:        'Added Data',
  edit_data:       'Edited Data',
  delete_data:     'Deleted Data',
  generate_report: 'Generated Report',
  export_report:   'Exported Report',
  create_user:     'Created User',
  update_user:     'Updated User',
  delete_user:     'Deleted User',
  change_role:     'Changed Role',
  reset_password:  'Reset Password',
  create_branch:   'Created Branch',
  update_branch:   'Updated Branch',
  create_mapping:  'Created Mapping',
  update_mapping:  'Updated Mapping',
  delete_mapping:  'Deleted Mapping',
};

const MODULE_LABELS: Record<AuditModule, string> = {
  auth:            'Auth',
  summary:         'Summary',
  reports:         'Reports',
  user_management: 'User Mgmt',
  settings:        'Settings',
  branches:        'Branches',
  mappings:        'Mappings',
};

function ActionIcon({ action }: { action: AuditAction }) {
  const cls = 'h-3.5 w-3.5';
  switch (action) {
    case 'login':           return <LogIn className={cls} />;
    case 'logout':          return <LogOut className={cls} />;
    case 'add_data':        return <Plus className={cls} />;
    case 'edit_data':       return <Edit2 className={cls} />;
    case 'delete_data':     return <Trash2 className={cls} />;
    case 'generate_report': return <BarChart3 className={cls} />;
    case 'export_report':   return <Download className={cls} />;
    case 'create_user':
    case 'update_user':
    case 'delete_user':
    case 'change_role':
    case 'reset_password':  return <Users className={cls} />;
    case 'create_branch':
    case 'update_branch':   return <GitBranch className={cls} />;
    case 'create_mapping':
    case 'update_mapping':
    case 'delete_mapping':  return <Map className={cls} />;
    default:                return <Eye className={cls} />;
  }
}

function actionColorClass(action: AuditAction): string {
  if (['login', 'logout'].includes(action))
    return 'bg-slate-100 text-slate-700 border-slate-200';
  if (['add_data', 'create_user', 'create_branch', 'create_mapping'].includes(action))
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (['edit_data', 'update_user', 'update_branch', 'update_mapping', 'change_role', 'reset_password'].includes(action))
    return 'bg-blue-100 text-blue-700 border-blue-200';
  if (['delete_data', 'delete_user', 'delete_mapping'].includes(action))
    return 'bg-red-100 text-red-700 border-red-200';
  if (['generate_report', 'export_report'].includes(action))
    return 'bg-purple-100 text-purple-700 border-purple-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

// ---------------------------------------------------------------------------
// Log detail expander
// ---------------------------------------------------------------------------
function LogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const hasMeta = log.metadata && Object.keys(log.metadata).length > 0;

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3 bg-white hover:bg-blue-50/60 transition-colors">
        {/* Timestamp */}
        <div className="w-[130px] shrink-0 text-xs text-muted-foreground pt-0.5">
          <div className="font-semibold text-card-foreground">
            {format(parseISO(log.created_at), 'MMM d, yyyy')}
          </div>
          <div>{format(parseISO(log.created_at), 'h:mm:ss a')}</div>
        </div>

        {/* Action badge */}
        <div className="w-[160px] shrink-0">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${actionColorClass(log.action)}`}>
            <ActionIcon action={log.action} />
            {ACTION_LABELS[log.action] ?? log.action}
          </span>
        </div>

        {/* Module badge */}
        <div className="w-[100px] shrink-0">
          <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60">
            {MODULE_LABELS[log.module] ?? log.module}
          </span>
        </div>

        {/* User */}
        <div className="w-[180px] shrink-0">
          <div className="text-xs font-medium text-card-foreground truncate">{log.user_email}</div>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${getRoleBadgeClass(log.user_role as any)}`}>
            {getRoleLabel(log.user_role as any)}
          </span>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-card-foreground/80 truncate">{log.details ?? log.target_name ?? '—'}</p>
          {log.target_name && log.details && log.target_name !== log.details && (
            <p className="text-xs text-muted-foreground truncate">{log.target_name}</p>
          )}
        </div>

        {/* Expand */}
        {hasMeta && (
          <button
            onClick={() => setExpanded(p => !p)}
            className="text-xs text-primary underline-offset-2 hover:underline shrink-0"
          >
            {expanded ? 'Less' : 'More'}
          </button>
        )}
      </div>

      {expanded && hasMeta && (
        <div className="px-4 py-3 bg-slate-50 border-t border-border/50">
          <pre className="text-xs text-slate-600 whitespace-pre-wrap break-all font-mono">
            {JSON.stringify(log.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ActivityLogsPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { branchOptions } = useLiveBranches();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch]         = useState('');
  const [filterAction, setFilterAction] = useState<AuditAction | 'all'>('all');
  const [filterModule, setFilterModule] = useState<AuditModule | 'all'>('all');
  const [filterBranch, setFilterBranch] = useState('all');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast({ variant: 'destructive', title: 'Access denied', description: 'Admin only.' });
      navigate('/app/summary', { replace: true });
    }
  }, [loading, isAdmin, navigate, toast]);

  const load = useCallback(async (p = 1) => {
    if (!isAdmin) return;
    setLoadingLogs(true);
    try {
      const branchUuid = filterBranch !== 'all'
        ? branchOptions.find(b => b.name === filterBranch)?.id
        : undefined;

      const { logs: rows, total: count } = await listAuditLogs({
        search:   search || undefined,
        action:   filterAction !== 'all' ? filterAction : undefined,
        module:   filterModule !== 'all' ? filterModule : undefined,
        branchId: branchUuid,
        dateFrom: dateFrom || undefined,
        dateTo:   dateTo   || undefined,
        page:     p,
        pageSize: PAGE_SIZE,
      });
      setLogs(rows);
      setTotal(count);
      setPage(p);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to load logs', description: String(err) });
    } finally {
      setLoadingLogs(false);
    }
  }, [isAdmin, search, filterAction, filterModule, filterBranch, dateFrom, dateTo, branchOptions, toast]);

  useEffect(() => {
    if (isAdmin) void load(1);
  }, [isAdmin, filterAction, filterModule, filterBranch, dateFrom, dateTo]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); void load(1); };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (loading || !isAdmin) return null;

  return (
    <div className="max-w-[1600px] mx-auto px-8 py-8">
      <Card className="rounded-3xl shadow-xl p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 rounded-2xl p-4">
              <ScrollText className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-card-foreground">Activity Logs</h2>
              <p className="text-muted-foreground text-sm">
                Audit trail of all user actions — {total.toLocaleString()} total records
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => void load(1)}
            disabled={loadingLogs}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingLogs ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-muted/40 rounded-2xl p-4 space-y-3 border border-border/50">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by user, action details, or target…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 rounded-full bg-white border-border text-card-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
              />
            </div>
            <Button type="submit" className="rounded-full px-6">Search</Button>
          </form>

          {/* Filter row */}
          <div className="flex flex-wrap gap-2">
            {/* Action filter */}
            <Select value={filterAction} onValueChange={v => setFilterAction(v as any)}>
              <SelectTrigger className="w-[175px] rounded-full bg-white border-border text-card-foreground">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {(Object.entries(ACTION_LABELS) as [AuditAction, string][]).map(([v, label]) => (
                  <SelectItem key={v} value={v}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Module filter */}
            <Select value={filterModule} onValueChange={v => setFilterModule(v as any)}>
              <SelectTrigger className="w-[150px] rounded-full bg-white border-border text-card-foreground">
                <SelectValue placeholder="All modules" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modules</SelectItem>
                {(Object.entries(MODULE_LABELS) as [AuditModule, string][]).map(([v, label]) => (
                  <SelectItem key={v} value={v}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Branch filter */}
            <Select value={filterBranch} onValueChange={setFilterBranch}>
              <SelectTrigger className="w-[150px] rounded-full bg-white border-border text-card-foreground">
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branchOptions.map(b => (
                  <SelectItem key={b.name} value={b.name}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date from */}
            <div className="flex flex-col justify-center">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-0.5">From</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-[155px] rounded-full bg-white border-border text-card-foreground [color-scheme:light]"
              />
            </div>

            {/* Date to */}
            <div className="flex flex-col justify-center">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-0.5">To</label>
              <Input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-[155px] rounded-full bg-white border-border text-card-foreground [color-scheme:light]"
              />
            </div>

            {/* Clear filters */}
            {(filterAction !== 'all' || filterModule !== 'all' || filterBranch !== 'all' || dateFrom || dateTo || search) && (
              <div className="flex items-end pb-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-muted-foreground hover:text-card-foreground"
                  onClick={() => {
                    setSearch(''); setFilterAction('all'); setFilterModule('all');
                    setFilterBranch('all'); setDateFrom(''); setDateTo('');
                  }}
                >
                  ✕ Clear
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Column headers */}
        <div className="hidden md:flex items-center gap-3 px-4 py-2 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase border-b border-border/50">
          <div className="w-[130px] shrink-0">Timestamp</div>
          <div className="w-[160px] shrink-0">Action</div>
          <div className="w-[100px] shrink-0">Module</div>
          <div className="w-[180px] shrink-0">User</div>
          <div className="flex-1">Details</div>
        </div>

        {/* Log rows */}
        <div className="space-y-1.5">
          {loadingLogs ? (
            <div className="text-center py-16 text-muted-foreground">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-primary/40" />
              <p className="text-sm">Loading activity logs…</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16">
              <ScrollText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm font-medium text-card-foreground/70">No activity logs found</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters or run some actions to see them here.</p>
            </div>
          ) : (
            logs.map(log => <LogRow key={log.id} log={log} />)
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-card-foreground/70">
            Page {page} of {totalPages} · {total.toLocaleString()} records
          </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={page <= 1 || loadingLogs}
                onClick={() => void load(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={page >= totalPages || loadingLogs}
                onClick={() => void load(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
