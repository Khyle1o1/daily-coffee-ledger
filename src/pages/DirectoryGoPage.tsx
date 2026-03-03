import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, Link2, AlertTriangle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getDirectoryLinkById } from '@/services/directoryLinksService';
import type { DirectoryLink } from '@/lib/supabase-types';

type Status = 'loading' | 'redirecting' | 'not_found' | 'inactive' | 'error';

export default function DirectoryGoPage() {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState<Status>('loading');
  const [link, setLink] = useState<DirectoryLink | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!id) {
      setStatus('not_found');
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const found = await getDirectoryLinkById(id);

        if (cancelled) return;

        if (!found) {
          setStatus('not_found');
          return;
        }

        setLink(found);

        if (!found.is_active) {
          setStatus('inactive');
          return;
        }

        setStatus('redirecting');
        // Small delay so user sees the redirect message
        setTimeout(() => {
          if (!cancelled) {
            window.location.href = found.url;
          }
        }, 800);
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : 'An error occurred');
          setStatus('error');
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="rounded-3xl shadow-xl p-10 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Looking up link…</p>
          </>
        )}

        {status === 'redirecting' && link && (
          <>
            <div className="bg-primary/10 rounded-2xl p-4 w-fit mx-auto mb-4">
              <Link2 className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-card-foreground mb-1">{link.name}</h2>
            <p className="text-muted-foreground mb-4 text-sm break-all">{link.url}</p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Redirecting…
            </div>
          </>
        )}

        {status === 'not_found' && (
          <>
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold text-card-foreground mb-2">Link Not Found</h2>
            <p className="text-muted-foreground mb-6">
              This directory link doesn't exist or has been removed.
            </p>
            <Button asChild className="rounded-full">
              <Link to="/app/directory">Back to Directory</Link>
            </Button>
          </>
        )}

        {status === 'inactive' && link && (
          <>
            <div className="bg-muted rounded-2xl p-4 w-fit mx-auto mb-4">
              <Lock className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold text-card-foreground mb-1">Link is Inactive</h2>
            <p className="text-muted-foreground mb-2 text-sm">
              "{link.name}" is currently disabled and cannot be accessed.
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Contact an administrator to re-activate this link.
            </p>
            <Button asChild className="rounded-full">
              <Link to="/app/directory">Back to Directory</Link>
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold text-card-foreground mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-6 text-sm">{errorMessage}</p>
            <Button asChild className="rounded-full">
              <Link to="/app/directory">Back to Directory</Link>
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
