import { Coffee, Calendar, CalendarDays, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-primary">
      {/* Top Bar */}
      <header className="border-b border-primary-foreground/20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Coffee className="h-7 w-7 text-primary-foreground" strokeWidth={2.5} />
            <h1 className="text-xl font-bold text-primary-foreground">DOT Coffee Daily Summary</h1>
            <span className="text-xs px-2 py-1 rounded-full border border-primary-foreground/70 text-primary-foreground font-semibold">
              MVP
            </span>
          </div>
          <Button
            variant="outline"
            className="rounded-full border-2 border-primary-foreground/70 bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary"
            onClick={() => navigate('/login')}
          >
            Log In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <div className="bg-primary-foreground/10 rounded-full p-6 w-24 h-24 mx-auto mb-8 flex items-center justify-center">
          <Coffee className="h-12 w-12 text-primary-foreground" strokeWidth={2} />
        </div>
        <h2 className="text-5xl font-bold text-primary-foreground mb-4">
          Track daily and monthly sales summaries in one place.
        </h2>
        <p className="text-xl text-primary-foreground/80 mb-10 max-w-2xl mx-auto">
          Upload CSVs, compute totals, and store reports securely. Built for DOT Coffee branches.
        </p>
        <Button
          size="lg"
          className="rounded-full px-10 py-6 text-lg bg-primary-foreground text-primary font-bold hover:bg-primary-foreground/90 shadow-2xl"
          onClick={() => navigate('/login')}
        >
          Log in to continue
        </Button>
      </section>

      {/* Feature Cards */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Daily Summary Card */}
          <div className="bg-card rounded-3xl p-8 shadow-xl">
            <div className="bg-primary/10 rounded-2xl p-4 w-16 h-16 mb-6 flex items-center justify-center">
              <Calendar className="h-8 w-8 text-primary" strokeWidth={2} />
            </div>
            <h3 className="text-2xl font-bold text-card-foreground mb-3">Daily Summary</h3>
            <p className="text-muted-foreground leading-relaxed">
              Upload daily transaction CSVs and generate detailed summaries by category with
              real-time totals and breakdowns.
            </p>
          </div>

          {/* Monthly Summary Card */}
          <div className="bg-card rounded-3xl p-8 shadow-xl">
            <div className="bg-primary/10 rounded-2xl p-4 w-16 h-16 mb-6 flex items-center justify-center">
              <CalendarDays className="h-8 w-8 text-primary" strokeWidth={2} />
            </div>
            <h3 className="text-2xl font-bold text-card-foreground mb-3">Monthly Summary</h3>
            <p className="text-muted-foreground leading-relaxed">
              Automatically aggregate daily reports into monthly views with day-by-day breakdowns
              and trend analysis.
            </p>
          </div>

          {/* Branch-based Reporting Card */}
          <div className="bg-card rounded-3xl p-8 shadow-xl">
            <div className="bg-primary/10 rounded-2xl p-4 w-16 h-16 mb-6 flex items-center justify-center">
              <MapPin className="h-8 w-8 text-primary" strokeWidth={2} />
            </div>
            <h3 className="text-2xl font-bold text-card-foreground mb-3">Branch-based Reporting</h3>
            <p className="text-muted-foreground leading-relaxed">
              Track sales across all DOT Coffee locations: Greenbelt, Podium, Mind Museum,
              Trinoma, and Uptown.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-primary-foreground/20 py-8 mt-20">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-primary-foreground/60 text-sm">
            &copy; {new Date().getFullYear()} DOT Coffee. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
