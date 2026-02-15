import type { DailyReport, BranchId } from "@/utils/types";
import { BRANCHES } from "@/utils/types";
import { formatNumber } from "@/utils/format";
import { Calendar, MapPin } from "lucide-react";

interface Props {
  reports: DailyReport[];
  activeReportId: string | null;
  onSelect: (reportId: string) => void;
}

// Group reports by date
function groupByDate(reports: DailyReport[]): Record<string, DailyReport[]> {
  const grouped: Record<string, DailyReport[]> = {};
  reports.forEach(report => {
    if (!grouped[report.date]) {
      grouped[report.date] = [];
    }
    grouped[report.date].push(report);
  });
  return grouped;
}

export default function DailyHistoryList({ reports, activeReportId, onSelect }: Props) {
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

  const groupedReports = groupByDate(reports);
  const sortedDates = Object.keys(groupedReports).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-foreground/60 mb-3 px-1">
        Daily History
      </h3>
      {sortedDates.map(date => {
        const dateReports = groupedReports[date].sort((a, b) => a.branch.localeCompare(b.branch));
        const dateTotalAmount = dateReports.reduce((sum, r) => sum + r.grandTotal, 0);
        
        return (
          <div key={date} className="space-y-1.5">
            {/* Date Header */}
            <div className="px-2.5 py-1.5 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-card-foreground">{date}</span>
                <span className="text-xs font-bold text-primary">₱{formatNumber(dateTotalAmount)}</span>
              </div>
              {dateReports.length > 1 && (
                <span className="text-[10px] text-muted-foreground">{dateReports.length} branches</span>
              )}
            </div>
            
            {/* Branch Items */}
            <div className="space-y-1.5 pl-1.5">
              {dateReports.map(report => {
                const branchLabel = BRANCHES.find(b => b.id === report.branch)?.label || report.branch;
                const isActive = activeReportId === report.id;
                
                return (
                  <button
                    key={report.id}
                    onClick={() => onSelect(report.id)}
                    className={`w-full text-left p-2 rounded-lg transition-all shadow-sm ${
                      isActive
                        ? "bg-primary text-primary-foreground scale-[1.02] shadow-md"
                        : "bg-card text-card-foreground hover:bg-card/80 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <MapPin className={`h-3 w-3 ${isActive ? 'text-primary-foreground' : 'text-primary'}`} />
                        <span className={`font-semibold text-xs ${isActive ? 'text-primary-foreground' : 'text-card-foreground'}`}>
                          {branchLabel}
                        </span>
                      </div>
                      <span className={`text-xs font-bold ${isActive ? 'text-primary-foreground' : 'text-primary'}`}>
                        ₱{formatNumber(report.grandTotal)}
                      </span>
                    </div>
                    
                    {/* Category chips */}
                    <div className="flex flex-wrap gap-1">
                      {(["ICED", "HOT", "SNACKS", "ADD-ONS"] as const).map(cat => (
                        report.summaryTotalsByCat[cat] > 0 && (
                          <span
                            key={cat}
                            className={`text-[8px] px-1.5 py-0.5 rounded-full font-semibold ${
                              isActive
                                ? 'bg-primary-foreground/20 text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {cat}: {formatNumber(report.summaryTotalsByCat[cat])}
                          </span>
                        )
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
