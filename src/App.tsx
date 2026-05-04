import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AppShell from "./layout/AppShell";
import SummaryPage from "./pages/SummaryPage";
import ReportsPage from "./pages/ReportsPage";
import UserManagementPage from "./pages/UserManagementPage";
import ActivityLogsPage from "./pages/ActivityLogsPage";
import DirectoryPage from "./pages/DirectoryPage";
import DirectoryGoPage from "./pages/DirectoryGoPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Reduce accidental traffic spikes from tab-focus/reconnect storms.
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

const localStoragePersister = createSyncStoragePersister({
  storage: window.localStorage,
  key: "daily-coffee-ledger-react-query-cache",
});

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister: localStoragePersister,
      maxAge: 24 * 60 * 60 * 1000,
      buster: "v2-user-scoped-report-cache",
    }}
  >
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Protected Routes */}
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/app/summary" replace />} />
              <Route path="summary" element={<SummaryPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="users" element={<UserManagementPage />} />
              <Route path="activity-logs" element={<ActivityLogsPage />} />
              <Route path="directory" element={<DirectoryPage />} />
              <Route path="directory/go/:id" element={<DirectoryGoPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* Catch-all Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </PersistQueryClientProvider>
);

export default App;
