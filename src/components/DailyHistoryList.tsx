import type { DailyReport } from "@/utils/types";
import { formatNumber } from "@/utils/format";
import { Calendar, FileText } from "lucide-react";

interface Props {
  reports: DailyReport[];
  activeDate: string | null;
  onSelect: (date: string) => void;
}

export default function DailyHistoryList({ reports, activeDate, onSelect }: Props) {
  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Calendar className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">No reports yet</p>
        <p className="text-xs mt-1">Upload a CSV to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
        Daily History
      </h3>
      {reports.map(r => (
        <button
          key={r.date}
          onClick={() => onSelect(r.date)}
          className={`w-full text-left p-3 rounded-lg border transition-all ${
            activeDate === r.date
              ? "border-primary bg-primary/10 shadow-sm"
              : "border-border bg-history-card hover:bg-history-hover"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-sm">{r.date}</span>
            <span className="text-xs font-bold text-primary">
              ₱{formatNumber(r.grandTotal)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
            <FileText className="h-3 w-3" />
            <span className="truncate">{r.filename}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {(["ICED", "HOT", "SNACKS", "ADD-ONS", "PACKAGING"] as const).map(cat => (
              r.summaryTotalsByCat[cat] > 0 && (
                <span key={cat} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                  {cat}: {formatNumber(r.summaryTotalsByCat[cat])}
                </span>
              )
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}
