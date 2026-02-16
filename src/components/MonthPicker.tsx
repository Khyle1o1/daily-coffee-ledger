import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { adjustMonth, formatMonthDisplay } from "@/utils/aggregateMonthly";

interface MonthPickerProps {
  selectedMonth: string; // YYYY-MM format
  onMonthChange: (monthKey: string) => void;
  className?: string;
}

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export default function MonthPicker({ selectedMonth, onMonthChange, className }: MonthPickerProps) {
  const [year, month] = selectedMonth.split("-");
  const currentYear = new Date().getFullYear();
  
  // Generate year options (current year ± 5 years)
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i).map(y => String(y));

  const handlePrevMonth = () => {
    onMonthChange(adjustMonth(selectedMonth, -1));
  };

  const handleNextMonth = () => {
    onMonthChange(adjustMonth(selectedMonth, 1));
  };

  const handleMonthSelect = (newMonth: string) => {
    onMonthChange(`${year}-${newMonth}`);
  };

  const handleYearSelect = (newYear: string) => {
    onMonthChange(`${newYear}-${month}`);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Previous Month Button */}
      <Button
        variant="outline"
        size="icon"
        className="h-10 w-10 rounded-full border-2 border-primary-foreground/70 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 transition-all"
        onClick={handlePrevMonth}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Month Display / Picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "px-5 py-2.5 h-auto rounded-full bg-transparent border-2 border-primary-foreground/70 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground transition-all font-semibold min-w-[200px]"
            )}
          >
            <Calendar className="mr-2 h-4 w-4" />
            {formatMonthDisplay(selectedMonth)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="center">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">Month</label>
              <Select value={month} onValueChange={handleMonthSelect}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(m => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">Year</label>
              <Select value={year} onValueChange={handleYearSelect}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Next Month Button */}
      <Button
        variant="outline"
        size="icon"
        className="h-10 w-10 rounded-full border-2 border-primary-foreground/70 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 transition-all"
        onClick={handleNextMonth}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
