import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Trash2, Shield, User as UserIcon, Loader2, Eye, EyeOff, Pencil, Archive, ArchiveRestore } from 'lucide-react';
import { logEvent } from '@/services/auditService';
import { getRoleBadgeClass, getRoleLabel } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/auth/useAuth';
import {
  listAllUsers,
  createUser,
  deleteUser,
  updateUserProfile,
  resetUserPassword,
  archiveUser,
  restoreUser,
  getActivityCountsForUsers,
} from '@/services/userService';
import type { UserProfile, UserRole } from '@/lib/supabase-types';
import { format } from 'date-fns';

export default function UserManagementPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin, user: currentUser, loading } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [activityCounts, setActivityCounts] = useState<Record<string, number>>({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Create user form
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit user form (role + optional password)
  const [editRole, setEditRole] = useState<UserRole>('user');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Access denied',
        description: 'You must be an administrator to access User Management.',
      });
      navigate('/app/summary', { replace: true });
    }
  }, [loading, isAdmin, navigate, toast]);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const data = await listAllUsers();
      setUsers(data);
      // Fetch activity counts so we know delete vs archive for each user
      const ids = data.map(u => u.user_id);
      const counts = await getActivityCountsForUsers(ids);
      setActivityCounts(counts);
    } catch (error) {
      console.error('Failed to load users:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to load users',
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newEmail || !newPassword) {
      toast({
        variant: 'destructive',
        title: 'Missing fields',
        description: 'Email and password are required',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Password too short',
        description: 'Password must be at least 6 characters',
      });
      return;
    }

    try {
      setCreating(true);
      const created = await createUser({
        email: newEmail,
        password: newPassword,
        role: newRole,
      });
      void logEvent({
        action: 'create_user',
        module: 'user_management',
        targetId: created.user_id,
        targetName: newEmail,
        details: `Created ${newRole} account for ${newEmail}`,
        metadata: { email: newEmail, role: newRole },
      });
      toast({
        title: 'User created',
        description: `${newEmail} has been created successfully`,
      });
      
      setShowCreateDialog(false);
      setNewEmail('');
      setNewPassword('');
      setNewRole('user');
      await loadUsers();
    } catch (error) {
      console.error('Failed to create user:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to create user',
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmArchive = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      await archiveUser(selectedUser.user_id);
      void logEvent({
        action: 'update_user',
        module: 'user_management',
        targetId: selectedUser.user_id,
        targetName: selectedUser.email,
        details: `Archived user ${selectedUser.email}`,
        metadata: { archived: true },
      });
      toast({ title: 'User archived', description: `${selectedUser.email} has been archived and can no longer sign in.` });
      setShowArchiveDialog(false);
      setSelectedUser(null);
      await loadUsers();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Failed to archive user', description: error instanceof Error ? error.message : 'An error occurred' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      await deleteUser(selectedUser.user_id);
      void logEvent({
        action: 'delete_user',
        module: 'user_management',
        targetId: selectedUser.user_id,
        targetName: selectedUser.email,
        details: `Permanently deleted user ${selectedUser.email}`,
      });
      toast({ title: 'User deleted', description: `${selectedUser.email} has been permanently deleted.` });
      setShowDeleteDialog(false);
      setSelectedUser(null);
      await loadUsers();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Failed to delete user', description: error instanceof Error ? error.message : 'An error occurred' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestoreUser = async (userId: string, email: string) => {
    try {
      await restoreUser(userId);
      void logEvent({
        action: 'update_user',
        module: 'user_management',
        targetId: userId,
        targetName: email,
        details: `Restored archived user ${email}`,
        metadata: { archived: false },
      });
      toast({ title: 'User restored', description: `${email} can now sign in again.` });
      await loadUsers();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Failed to restore user', description: error instanceof Error ? error.message : 'An error occurred' });
    }
  };

  const openEditDialog = (userProfile: UserProfile) => {
    setSelectedUser(userProfile);
    setEditRole(userProfile.role);
    setEditPassword('');
    setShowEditPassword(false);
    setShowEditDialog(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (editPassword && editPassword.length < 6) {
      toast({ variant: 'destructive', title: 'Password too short', description: 'Password must be at least 6 characters' });
      return;
    }

    setSaving(true);
    try {
      const roleChanged = editRole !== selectedUser.role;
      const passwordChanged = editPassword.length >= 6;

      if (roleChanged) {
        await updateUserProfile(selectedUser.user_id, { role: editRole });
        void logEvent({
          action: 'change_role',
          module: 'user_management',
          targetId: selectedUser.user_id,
          targetName: selectedUser.email,
          details: `Changed role of ${selectedUser.email} to ${editRole}`,
          metadata: { email: selectedUser.email, oldRole: selectedUser.role, newRole: editRole },
        });
      }

      if (passwordChanged) {
        await resetUserPassword(selectedUser.user_id, editPassword);
        void logEvent({
          action: 'reset_password',
          module: 'user_management',
          targetId: selectedUser.user_id,
          targetName: selectedUser.email,
          details: `Reset password for ${selectedUser.email}`,
        });
      }

      if (!roleChanged && !passwordChanged) {
        toast({ title: 'No changes', description: 'Nothing was updated.' });
        setShowEditDialog(false);
        return;
      }

      const parts: string[] = [];
      if (roleChanged) parts.push(`role set to ${getRoleLabel(editRole)}`);
      if (passwordChanged) parts.push('password reset');
      toast({ title: 'User updated', description: `${selectedUser.email}: ${parts.join(' and ')}.` });

      setShowEditDialog(false);
      setSelectedUser(null);
      setEditPassword('');
      await loadUsers();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Failed to save changes', description: error instanceof Error ? error.message : 'An error occurred' });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !isAdmin) {
    return null;
  }

  return (
    <div className="max-w-[1600px] mx-auto px-8 py-8">
      <Card className="rounded-3xl shadow-xl p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 rounded-2xl p-4">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-card-foreground">User Management</h2>
              <p className="text-muted-foreground">Create and manage user accounts</p>
            </div>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create User
          </Button>
        </div>

        {/* User List */}
        {loadingUsers ? (
          <div className="text-center py-16">
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16">
            <UserIcon className="h-20 w-20 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-xl font-semibold text-card-foreground mb-2">No users yet</p>
            <p className="text-muted-foreground mb-6">Create your first user account</p>
            <Button onClick={() => setShowCreateDialog(true)} className="rounded-full">
              <Plus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((userProfile) => {
              const isCurrentUser = currentUser?.id === userProfile.user_id;
              const isArchived = userProfile.is_archived;
              const hasActivity = (activityCounts[userProfile.user_id] ?? 0) > 0;

              return (
                <div
                  key={userProfile.id}
                  className={`flex items-center justify-between p-4 border rounded-2xl transition-colors ${
                    isArchived
                      ? 'border-gray-200 bg-gray-50 opacity-60'
                      : 'border-gray-200 bg-white hover:bg-blue-50/40'
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`rounded-xl p-3 shrink-0 ${isArchived ? 'bg-gray-100' : 'bg-blue-50'}`}>
                      {isArchived ? (
                        <Archive className="h-5 w-5 text-gray-400" />
                      ) : userProfile.role === 'admin' ? (
                        <Shield className="h-5 w-5 text-primary" />
                      ) : userProfile.role === 'viewer' ? (
                        <Eye className="h-5 w-5 text-primary" />
                      ) : (
                        <UserIcon className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold text-gray-900">{userProfile.email}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${getRoleBadgeClass(userProfile.role)}`}>
                          {getRoleLabel(userProfile.role)}
                        </span>
                        {isArchived && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                            Archived
                          </span>
                        )}
                        {isCurrentUser && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Created {format(new Date(userProfile.created_at), 'MMM dd, yyyy')}
                        {isArchived && userProfile.archived_at && (
                          <> · Archived {format(new Date(userProfile.archived_at), 'MMM dd, yyyy')}</>
                        )}
                        {!isArchived && hasActivity && (
                          <> · {activityCounts[userProfile.user_id]} log {activityCounts[userProfile.user_id] === 1 ? 'entry' : 'entries'}</>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Edit button — opens unified role + password modal */}
                    {!isCurrentUser && !isArchived && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-gray-200 text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 bg-white font-medium gap-1.5"
                        onClick={() => openEditDialog(userProfile)}
                        title="Edit user"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    )}

                    {/* Restore button for archived users */}
                    {!isCurrentUser && isArchived && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-medium"
                        onClick={() => handleRestoreUser(userProfile.user_id, userProfile.email)}
                        title="Restore user"
                      >
                        <ArchiveRestore className="h-4 w-4 mr-1.5" />
                        Restore
                      </Button>
                    )}

                    {/* Archive or Delete button */}
                    {!isCurrentUser && !isArchived && (
                      hasActivity ? (
                        /* Has activity logs → can only archive */
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl bg-white text-amber-700 border-amber-300 hover:bg-amber-50 font-medium"
                          onClick={() => { setSelectedUser(userProfile); setShowArchiveDialog(true); }}
                          title="Archive user (has activity history)"
                        >
                          <Archive className="h-4 w-4 mr-1.5" />
                          Archive
                        </Button>
                      ) : (
                        /* No activity logs → can hard delete */
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl bg-white text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => { setSelectedUser(userProfile); setShowDeleteDialog(true); }}
                          title="Delete user permanently"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="rounded-3xl bg-primary text-primary-foreground border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Create New User</DialogTitle>
            <DialogDescription className="text-primary-foreground/80">
              Create a new user account. They will be able to sign in immediately.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-primary-foreground font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="rounded-xl bg-primary/20 border-primary/40 text-primary-foreground placeholder:text-primary-foreground/70"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-primary-foreground font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="rounded-xl pr-10 bg-primary/20 border-primary/40 text-primary-foreground placeholder:text-primary-foreground/70"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-foreground/70 hover:text-primary-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-primary-foreground/80">Minimum 6 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role" className="text-primary-foreground font-medium">
                  Role
                </Label>
                <Select value={newRole} onValueChange={(value) => setNewRole(value as UserRole)}>
                  <SelectTrigger className="rounded-xl bg-primary/20 border-primary/40 text-primary-foreground">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                className="rounded-xl border-primary-foreground/40 text-primary-foreground hover:bg-primary/20"
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                disabled={creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create User'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={open => { setShowEditDialog(open); if (!open) { setSelectedUser(null); setEditPassword(''); } }}>
        <DialogContent className="rounded-3xl shadow-2xl max-w-md bg-white text-gray-900 border-0">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="bg-blue-100 rounded-xl p-2.5 shrink-0">
                <Pencil className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold text-gray-900">Edit User</DialogTitle>
                <p className="text-sm text-gray-500 mt-0.5">{selectedUser?.email}</p>
              </div>
            </div>
          </DialogHeader>
          <form onSubmit={handleSaveEdit}>
            <div className="space-y-5 py-4">
              {/* Role */}
              <div className="space-y-2">
                <Label htmlFor="edit-role" className="text-gray-700 font-medium text-sm">Role</Label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
                  <SelectTrigger id="edit-role" className="rounded-xl bg-white border-gray-200 text-gray-900 focus:ring-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400">Current role: <span className="font-medium text-gray-600">{getRoleLabel(selectedUser?.role ?? 'user')}</span></p>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100" />

              {/* New Password (optional) */}
              <div className="space-y-2">
                <Label htmlFor="edit-password" className="text-gray-700 font-medium text-sm">New Password <span className="text-gray-400 font-normal">(optional)</span></Label>
                <div className="relative">
                  <Input
                    id="edit-password"
                    type={showEditPassword ? 'text' : 'password'}
                    placeholder="Leave blank to keep current password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="rounded-xl pr-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  >
                    {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {editPassword && editPassword.length > 0 && editPassword.length < 6 && (
                  <p className="text-xs text-red-500">Minimum 6 characters required</p>
                )}
              </div>
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setShowEditDialog(false); setSelectedUser(null); setEditPassword(''); }}
                className="rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50"
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-primary text-white hover:bg-primary/90"
                disabled={saving}
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Archive Confirm Dialog */}
      <Dialog open={showArchiveDialog} onOpenChange={open => { setShowArchiveDialog(open); if (!open) setSelectedUser(null); }}>
        <DialogContent className="rounded-3xl shadow-2xl max-w-md bg-white text-gray-900 border-0">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-amber-100 rounded-xl p-2.5 shrink-0">
                <Archive className="h-5 w-5 text-amber-600" />
              </div>
              <DialogTitle className="text-xl font-semibold text-gray-900">Archive User</DialogTitle>
            </div>
            <DialogDescription asChild>
              <div className="text-sm text-gray-600 leading-relaxed pt-1 space-y-2">
                <p>
                  <span className="font-semibold text-gray-900">{selectedUser?.email}</span> has existing activity history and cannot be permanently deleted.
                </p>
                <p>
                  Archiving will <span className="font-semibold text-gray-900">prevent them from signing in</span> and hide them from active lists, but their activity logs will be preserved.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-4">
            <Button
              variant="outline"
              className="rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50"
              disabled={actionLoading}
              onClick={() => { setShowArchiveDialog(false); setSelectedUser(null); }}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white border-0"
              disabled={actionLoading}
              onClick={handleConfirmArchive}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Archive className="h-4 w-4 mr-2" />}
              Archive User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={open => { setShowDeleteDialog(open); if (!open) setSelectedUser(null); }}>
        <DialogContent className="rounded-3xl shadow-2xl max-w-md bg-white text-gray-900 border-0">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-red-100 rounded-xl p-2.5 shrink-0">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle className="text-xl font-semibold text-gray-900">Delete User</DialogTitle>
            </div>
            <DialogDescription asChild>
              <div className="text-sm text-gray-600 leading-relaxed pt-1 space-y-2">
                <p>
                  Are you sure you want to permanently delete{' '}
                  <span className="font-semibold text-gray-900">{selectedUser?.email}</span>?
                </p>
                <p>
                  This action <span className="font-semibold text-gray-900">cannot be undone</span>. The account will be removed from both the app and authentication system.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-4">
            <Button
              variant="outline"
              className="rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50"
              disabled={actionLoading}
              onClick={() => { setShowDeleteDialog(false); setSelectedUser(null); }}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-red-500 hover:bg-red-600 text-white border-0"
              disabled={actionLoading}
              onClick={handleConfirmDelete}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
