import { Coffee, Calendar, CalendarDays, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="h-full overflow-y-auto bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-primary text-primary-foreground">
              <Coffee className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-[#172B4D]">DOT Coffee</h1>
              <p className="text-xs text-muted-foreground">Daily Ledger</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="rounded-[10px] border-border"
            onClick={() => navigate("/login")}
          >
            Log In
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-[20px] bg-primary/10">
          <Coffee className="h-10 w-10 text-primary" strokeWidth={2} />
        </div>
        <h2 className="mb-4 text-4xl font-semibold tracking-tight text-[#172B4D] sm:text-5xl">
          Track daily and monthly sales in one place.
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
          Upload CSVs, compute totals, and store reports securely. Built for DOT Coffee branches.
        </p>
        <Button
          size="lg"
          className="rounded-[10px] px-8 py-6 text-base font-semibold"
          onClick={() => navigate("/login")}
        >
          Log in to continue
        </Button>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="saas-card p-8">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-[14px] bg-primary/10">
              <Calendar className="h-7 w-7 text-primary" />
            </div>
            <h3 className="mb-3 text-xl font-semibold text-[#172B4D]">Daily Summary</h3>
            <p className="leading-relaxed text-muted-foreground">
              Upload daily transaction CSVs and generate detailed summaries by category with
              real-time totals and breakdowns.
            </p>
          </div>
          <div className="saas-card p-8">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-[14px] bg-primary/10">
              <CalendarDays className="h-7 w-7 text-primary" />
            </div>
            <h3 className="mb-3 text-xl font-semibold text-[#172B4D]">Monthly Summary</h3>
            <p className="leading-relaxed text-muted-foreground">
              Automatically aggregate daily reports into monthly views with day-by-day breakdowns
              and trend analysis.
            </p>
          </div>
          <div className="saas-card p-8">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-[14px] bg-primary/10">
              <MapPin className="h-7 w-7 text-primary" />
            </div>
            <h3 className="mb-3 text-xl font-semibold text-[#172B4D]">Branch-based Reporting</h3>
            <p className="leading-relaxed text-muted-foreground">
              Track sales across all DOT Coffee locations from a single, management-ready dashboard.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <p className="text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} DOT Coffee. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
