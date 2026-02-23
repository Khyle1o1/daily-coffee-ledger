import Index from './Index';

// For now, the Monthly Summary page is just the existing Index component
// The header is now in AppShell, so Index will only render the content area
export default function MonthlySummaryPage() {
  return <Index />;
}
