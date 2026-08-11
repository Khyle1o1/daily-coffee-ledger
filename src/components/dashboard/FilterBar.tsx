import { forwardRef } from "react";
import { Calendar, ChevronDown, Clock, MapPin, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FilterBar({
  dateControl,
  branchControl,
  compareControl,
  lastUpdatedLabel,
  onRefresh,
  isRefreshing,
  onAddData,
  canAddData,
  extraActions,
}: {
  dateControl: React.ReactNode;
  branchControl: React.ReactNode;
  compareControl?: React.ReactNode;
  lastUpdatedLabel?: string | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onAddData?: () => void;
  canAddData?: boolean;
  extraActions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {dateControl}
      {branchControl}
      {compareControl}

      <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5">
        {lastUpdatedLabel && (
          <p className="text-xs text-muted-foreground">
            Last updated: <span className="font-medium text-[#172B4D]">{lastUpdatedLabel}</span>
          </p>
        )}
        {onRefresh && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-xl border-border bg-white"
            onClick={onRefresh}
            aria-label="Refresh data"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        )}
        {extraActions}
        {canAddData && onAddData && (
          <Button
            type="button"
            onClick={onAddData}
            className="h-10 rounded-[10px] bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Data
          </Button>
        )}
      </div>
    </div>
  );
}

export const FilterTriggerButton = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button> & {
    icon: React.ComponentType<{ className?: string }>;
  }
>(function FilterTriggerButton({ icon: Icon, children, className, ...props }, ref) {
  return (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      className={cn(
        "h-10 justify-start rounded-xl border-border bg-white px-3.5 text-sm font-medium text-[#172B4D] hover:bg-muted/70",
        className,
      )}
      {...props}
    >
      <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
      <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
    </Button>
  );
});
FilterTriggerButton.displayName = "FilterTriggerButton";

export { Calendar as FilterCalendarIcon, MapPin as FilterMapPinIcon, Clock as FilterClockIcon };
