import type { UserRole } from '@/lib/supabase-types';

// Central permission definitions for every role.
// Always check permissions here — never scatter role strings across the codebase.

export function canAddData(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'user';
}

export function canEditData(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'user';
}

export function canDeleteData(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'user';
}

export function canManageUsers(role: UserRole | null | undefined): boolean {
  return role === 'admin';
}

export function canAccessSettings(role: UserRole | null | undefined): boolean {
  return role === 'admin';
}

export function canManageBranches(role: UserRole | null | undefined): boolean {
  return role === 'admin';
}

export function canManageMappings(role: UserRole | null | undefined): boolean {
  return role === 'admin';
}

export function canViewLogs(role: UserRole | null | undefined): boolean {
  return role === 'admin';
}

export function canGenerateReports(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'user' || role === 'viewer';
}

export function canExportReports(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'user' || role === 'viewer';
}

export function canViewSummary(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'user' || role === 'viewer';
}

export function canViewReports(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'user' || role === 'viewer';
}

// Human-readable label per role
export function getRoleLabel(role: UserRole | null | undefined): string {
  switch (role) {
    case 'admin':  return 'Admin';
    case 'user':   return 'User';
    case 'viewer': return 'Viewer';
    default:       return 'Unknown';
  }
}

// Badge color class per role (Tailwind)
export function getRoleBadgeClass(role: UserRole | null | undefined): string {
  switch (role) {
    case 'admin':  return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'user':   return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'viewer': return 'bg-purple-100 text-purple-800 border-purple-200';
    default:       return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}
