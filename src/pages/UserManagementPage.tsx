import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Shield, User as UserIcon, Loader2, Eye, EyeOff, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/auth/useAuth';
import {
  listAllUsers,
  createUser,
  deleteUser,
  updateUserProfile,
  resetUserPassword,
} from '@/services/userService';
import type { UserProfile, UserRole } from '@/lib/supabase-types';
import { format } from 'date-fns';

export default function UserManagementPage() {
  const { toast } = useToast();
  const { isAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  
  // Create user form
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  // Reset password form
  const [resetPassword, setResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await listAllUsers();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to load users',
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setLoading(false);
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
      await createUser({
        email: newEmail,
        password: newPassword,
        role: newRole,
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

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to delete user ${email}?`)) {
      return;
    }

    try {
      await deleteUser(userId);
      toast({
        title: 'User deleted',
        description: `${email} has been deleted`,
      });
      await loadUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to delete user',
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    }
  };

  const handleChangeRole = async (userId: string, email: string, newRole: UserRole) => {
    try {
      await updateUserProfile(userId, { role: newRole });
      toast({
        title: 'Role updated',
        description: `${email} is now ${newRole}`,
      });
      await loadUsers();
    } catch (error) {
      console.error('Failed to update role:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to update role',
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser || !resetPassword) {
      return;
    }

    if (resetPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Password too short',
        description: 'Password must be at least 6 characters',
      });
      return;
    }

    try {
      setResetting(true);
      await resetUserPassword(selectedUser.user_id, resetPassword);
      toast({
        title: 'Password reset',
        description: `Password for ${selectedUser.email} has been reset`,
      });
      setShowPasswordDialog(false);
      setSelectedUser(null);
      setResetPassword('');
    } catch (error) {
      console.error('Failed to reset password:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to reset password',
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setResetting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-[1600px] mx-auto px-8 py-16 text-center">
        <div className="bg-card rounded-3xl shadow-xl p-16">
          <Shield className="h-20 w-20 text-destructive mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-card-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You must be an administrator to access this page.</p>
        </div>
      </div>
    );
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
        {loading ? (
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
            {users.map((userProfile) => (
              <div
                key={userProfile.id}
                className="flex items-center justify-between p-4 border border-border rounded-2xl hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="bg-primary/10 rounded-xl p-3">
                    {userProfile.role === 'admin' ? (
                      <Shield className="h-5 w-5 text-primary" />
                    ) : (
                      <UserIcon className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-card-foreground">{userProfile.email}</p>
                      <Badge variant={userProfile.role === 'admin' ? 'default' : 'secondary'}>
                        {userProfile.role}
                      </Badge>
                      {currentUser?.id === userProfile.user_id && (
                        <Badge variant="outline">You</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Created {format(new Date(userProfile.created_at), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Change Role */}
                  {currentUser?.id !== userProfile.user_id && (
                    <Select
                      value={userProfile.role}
                      onValueChange={(value) => handleChangeRole(userProfile.user_id, userProfile.email, value as UserRole)}
                    >
                      <SelectTrigger className="w-[120px] rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {/* Reset Password */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => {
                      setSelectedUser(userProfile);
                      setShowPasswordDialog(true);
                    }}
                  >
                    <Key className="h-4 w-4" />
                  </Button>

                  {/* Delete User */}
                  {currentUser?.id !== userProfile.user_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteUser(userProfile.user_id, userProfile.email)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Create a new user account. They will be able to sign in immediately.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="rounded-xl"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="rounded-xl pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={newRole} onValueChange={(value) => setNewRole(value as UserRole)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                className="rounded-xl"
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl" disabled={creating}>
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

      {/* Reset Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showResetPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className="rounded-xl pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowPasswordDialog(false);
                  setSelectedUser(null);
                  setResetPassword('');
                }}
                className="rounded-xl"
                disabled={resetting}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl" disabled={resetting}>
                {resetting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  'Reset Password'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
