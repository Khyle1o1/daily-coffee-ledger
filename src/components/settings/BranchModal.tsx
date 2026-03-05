import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Branch } from '@/types/branch';

interface BranchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch?: Branch | null;
  onSave: (payload: {
    code: string;
    name: string;
    address?: string;
    isActive?: boolean;
  }) => Promise<void>;
}

interface FormErrors {
  code?: string;
  name?: string;
}

export function BranchModal({ open, onOpenChange, branch, onSave }: BranchModalProps) {
  const isEditing = !!branch;

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (branch) {
        setCode(branch.code ?? '');
        setName(branch.name ?? '');
        setAddress(branch.address ?? '');
        setIsActive(branch.isActive);
      } else {
        setCode('');
        setName('');
        setAddress('');
        setIsActive(true);
      }
      setErrors({});
      setServerError(null);
    }
  }, [open, branch]);

  const validate = (): boolean => {
    const next: FormErrors = {};

    if (!code.trim()) {
      next.code = 'Code is required';
    }

    if (!name.trim()) {
      next.name = 'Name is required';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    try {
      setSaving(true);
      await onSave({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        address: address.trim() || undefined,
        isActive,
      });
    } catch (error) {
      if (error instanceof Error) {
        setServerError(error.message);
      } else {
        setServerError('Failed to save branch');
      }
    } finally {
      setSaving(false);
    }
  };

  const isFormValid = code.trim().length > 0 && name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl bg-card text-card-foreground shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">
            {isEditing ? 'Edit Branch' : 'Add Branch'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isEditing
              ? 'Update the details for this branch.'
              : 'Create a new branch. You can use it immediately in reports.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Code */}
            <div className="space-y-2">
              <Label htmlFor="branch-code">
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="branch-code"
                placeholder="e.g. PODIUM"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  if (errors.code) {
                    setErrors((prev) => ({ ...prev, code: undefined }));
                  }
                }}
                className={`rounded-xl bg-muted placeholder:text-muted-foreground font-mono uppercase ${
                  errors.code ? 'border-destructive' : ''
                }`}
                disabled={saving}
              />
              {errors.code && (
                <p className="text-xs text-destructive">{errors.code}</p>
              )}
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="branch-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="branch-name"
                placeholder="e.g. Podium"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) {
                    setErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                className={`rounded-xl bg-muted placeholder:text-muted-foreground ${
                  errors.name ? 'border-destructive' : ''
                }`}
                disabled={saving}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="branch-address">Address</Label>
              <Input
                id="branch-address"
                placeholder="Optional branch address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="rounded-xl bg-muted placeholder:text-muted-foreground"
                disabled={saving}
              />
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between py-1">
              <div>
                <Label
                  htmlFor="branch-active"
                  className={`text-sm font-medium ${
                    isActive ? 'text-card-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Active
                </Label>
                <p
                  className={`text-xs ${
                    isActive ? 'text-muted-foreground' : 'text-muted-foreground/80'
                  }`}
                >
                  Inactive branches will be hidden from dropdowns by default but kept
                  in historical reports.
                </p>
              </div>
              <Switch
                id="branch-active"
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={saving}
              />
            </div>

            {serverError && (
              <p className="text-xs text-destructive">{serverError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-xl"
              disabled={saving || !isFormValid}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : isEditing ? (
                'Save Changes'
              ) : (
                'Add Branch'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

