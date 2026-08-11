import { useRef, useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useInvalidateBranches } from "@/hooks/useLiveBranches";
import { queryKeys } from "@/hooks/queries/queryKeys";
import {
  backupPackCounts,
  downloadBackupPack,
  formatRestoreSummary,
  parseBackupPack,
  restoreBackupPack,
  type BackupPack,
} from "@/services/backupService";

interface BackupRestoreSectionProps {
  onRestored?: () => void;
}

export function BackupRestoreSection({ onRestored }: BackupRestoreSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const invalidateBranches = useInvalidateBranches();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [downloading, setDownloading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [pendingPack, setPendingPack] = useState<BackupPack | null>(null);

  const refreshAfterRestore = () => {
    invalidateBranches();
    void queryClient.invalidateQueries({ queryKey: ["branches"] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.reports.dailyRoot });
    void queryClient.invalidateQueries({ queryKey: ["directory"] });
    onRestored?.();
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const pack = await downloadBackupPack();
      const counts = backupPackCounts(pack);
      toast({
        title: "Backup downloaded",
        description:
          `${counts.branches} branches, ${counts.mappings} mappings, ` +
          `${counts.reports} reports, ${counts.ledger} ledger days, ` +
          `${counts.directory} directory links.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Backup failed",
        description: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setParsing(true);
    try {
      const pack = await parseBackupPack(file);
      setPendingPack(pack);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Invalid backup file",
        description: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setParsing(false);
    }
  };

  const handleRestore = async () => {
    if (!pendingPack) return;
    setRestoring(true);
    try {
      const summary = await restoreBackupPack(pendingPack);
      setPendingPack(null);
      refreshAfterRestore();
      toast({
        title: summary.errors.length ? "Restore finished with warnings" : "Restore complete",
        description: formatRestoreSummary(summary),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Restore failed",
        description: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setRestoring(false);
    }
  };

  const counts = pendingPack ? backupPackCounts(pendingPack) : null;
  const busy = downloading || parsing || restoring;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase mb-1">
            Data
          </p>
          <h3 className="text-lg font-semibold text-card-foreground">
            Backup & restore
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            Download a JSON copy of branches, mappings, daily reports, cash ledger,
            and directory links. Restore merges into existing data — matching
            records are overwritten, everything else is kept.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() => void handleDownload()}
          disabled={busy}
          className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {downloading ? "Preparing backup…" : "Download backup"}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="rounded-full"
        >
          {parsing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {parsing ? "Reading file…" : "Restore from file"}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => void handleFileChange(event)}
        />
      </div>

      <AlertDialog
        open={pendingPack !== null}
        onOpenChange={(open) => {
          if (!open && !restoring) setPendingPack(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Matching records will be overwritten. Records that are not in the
              backup will be kept.
              {counts ? (
                <span className="mt-3 block text-slate-700">
                  {counts.branches} branches, {counts.mappings} mappings,{" "}
                  {counts.reports} reports, {counts.ledger} ledger days,{" "}
                  {counts.directory} directory links.
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              onClick={() => void handleRestore()}
              disabled={restoring}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {restoring ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {restoring ? "Restoring…" : "Restore"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
