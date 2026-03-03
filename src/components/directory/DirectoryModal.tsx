import { useState, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import type { DirectoryLink, CreateDirectoryLinkPayload } from '@/lib/supabase-types';

interface DirectoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link?: DirectoryLink | null;
  onSave: (payload: CreateDirectoryLinkPayload) => Promise<void>;
}

interface FormErrors {
  name?: string;
  url?: string;
}

function normalizeUrlPreview(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function DirectoryModal({
  open,
  onOpenChange,
  link,
  onSave,
}: DirectoryModalProps) {
  const isEditing = !!link;

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      if (link) {
        setName(link.name);
        setUrl(link.url);
        setDescription(link.description ?? '');
        setCategory(link.category ?? '');
        setIsActive(link.is_active);
      } else {
        setName('');
        setUrl('');
        setDescription('');
        setCategory('');
        setIsActive(true);
      }
      setErrors({});
    }
  }, [open, link]);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!url.trim()) {
      newErrors.url = 'URL is required';
    } else {
      const normalized = normalizeUrlPreview(url);
      if (!isValidUrl(normalized)) {
        newErrors.url = 'Enter a valid URL (http:// or https://)';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSaving(true);
      await onSave({
        name: name.trim(),
        url: url.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        is_active: isActive,
      });
    } finally {
      setSaving(false);
    }
  };

  const isFormValid = name.trim() !== '' && url.trim() !== '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl bg-card text-card-foreground shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">
            {isEditing ? 'Edit Link' : 'Add Link'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isEditing
              ? 'Update the details for this directory link.'
              : 'Add a new link to the directory.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="dir-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dir-name"
                placeholder="e.g. Google Drive"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
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

            {/* URL */}
            <div className="space-y-2">
              <Label htmlFor="dir-url">
                URL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dir-url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (errors.url) setErrors((prev) => ({ ...prev, url: undefined }));
                }}
                className={`rounded-xl bg-muted placeholder:text-muted-foreground ${
                  errors.url ? 'border-destructive' : ''
                }`}
                disabled={saving}
              />
              {errors.url ? (
                <p className="text-xs text-destructive">{errors.url}</p>
              ) : url.trim() && !url.trim().match(/^https?:\/\//i) ? (
                <p className="text-xs text-muted-foreground">
                  Will be saved as: {normalizeUrlPreview(url)}
                </p>
              ) : null}
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="dir-category">Category</Label>
              <Input
                id="dir-category"
                placeholder="e.g. Internal Tools"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-xl bg-muted placeholder:text-muted-foreground"
                disabled={saving}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="dir-description">Description</Label>
              <Textarea
                id="dir-description"
                placeholder="Optional short description…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-xl resize-none bg-muted placeholder:text-muted-foreground"
                rows={3}
                disabled={saving}
              />
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between py-1">
              <div>
                <Label
                  htmlFor="dir-active"
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
                  Inactive links cannot be opened via the redirect URL.
                </p>
              </div>
              <Switch
                id="dir-active"
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={saving}
              />
            </div>
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
                'Add Link'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
