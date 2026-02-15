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
      <div className="bg-card rounded-2xl shadow-lg p-8 flex flex-col items-center justify-center text-muted-foreground">
        <div className="bg-primary/5 rounded-full p-6 mb-4">
          <Calendar className="h-12 w-12 text-primary/40" strokeWidth={1.5} />
        </div>
        <p className="text-base font-semibold text-card-foreground">No reports yet</p>
        <p className="text-sm mt-1">Upload a CSV to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/60 mb-4 px-1">
        Daily History
      </h3>
      {reports.map(r => (
        <button
          key={r.date}
          onClick={() => onSelect(r.date)}
          className={`w-full text-left p-4 rounded-2xl transition-all shadow-md ${
            activeDate === r.date
              ? "bg-primary text-primary-foreground scale-[1.02] shadow-lg"
              : "bg-card text-card-foreground hover:bg-card/80 hover:shadow-lg"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`font-bold text-base ${activeDate === r.date ? 'text-primary-foreground' : 'text-card-foreground'}`}>
              {r.date}
            </span>
            <span className={`text-sm font-bold ${activeDate === r.date ? 'text-primary-foreground' : 'text-primary'}`}>
              ₱{formatNumber(r.grandTotal)}
            </span>
          </div>
          <div className={`flex items-center gap-2 text-xs mb-3 ${activeDate === r.date ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
            <FileText className="h-3.5 w-3.5" />
            <span className="truncate">{r.filename}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["ICED", "HOT", "SNACKS", "ADD-ONS", "PACKAGING"] as const).map(cat => (
              r.summaryTotalsByCat[cat] > 0 && (
                <span
                  key={cat}
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    activeDate === r.date
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
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
