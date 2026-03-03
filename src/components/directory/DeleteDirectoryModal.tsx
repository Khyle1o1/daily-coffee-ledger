import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DirectoryLink } from '@/lib/supabase-types';

interface DeleteDirectoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: DirectoryLink | null;
  onConfirm: (id: string) => Promise<void>;
}

export default function DeleteDirectoryModal({
  open,
  onOpenChange,
  link,
  onConfirm,
}: DeleteDirectoryModalProps) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    if (!link) return;
    try {
      setDeleting(true);
      await onConfirm(link.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete Link
          </DialogTitle>
          <DialogDescription>
            Delete this link? This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {link && (
          <div className="py-2 px-4 bg-muted rounded-xl text-sm">
            <p className="font-semibold text-card-foreground">{link.name}</p>
            <p className="text-muted-foreground truncate">{link.url}</p>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            className="rounded-xl"
            disabled={deleting}
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting…
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
