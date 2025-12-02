import React, { useState } from 'react';
import { Switch, Route, Redirect } from "wouter";
import { useTranslation } from 'react-i18next';
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { MfaChallenge } from "@/pages/MfaChallenge";
import { subscribe as subscribeMfa } from '@/lib/mfaBus';
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { GlobalSearch } from '@/components/GlobalSearch';
import { Button } from '@/components/ui/button';
import "@/i18n/config";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import ThreatMap from "@/pages/ThreatMap";
import Reports from "@/pages/Reports";
import { HelpCircle } from 'lucide-react';
import Subscription from "@/pages/Subscription";
import Checkout from "@/pages/Checkout";
import Settings from "@/pages/Settings";
import VirusTotalScan from "@/pages/VirusTotalScan";
import EventSources from "@/pages/EventSources";
import InstallGuide from "@/pages/InstallGuide";
import NetworkActivity from "@/pages/NetworkActivity";
import AdminDashboard from "@/pages/AdminDashboard";
import UserManagement from "@/pages/UserManagement";
import SystemAnalytics from "@/pages/SystemAnalytics";
import IpBlocklistManagement from '@/pages/IpBlocklistManagement';
import Compliance from "@/pages/Compliance";
import About from "@/pages/About";
import Blog from "@/pages/Blog";
import Careers from "@/pages/Careers";
import Contact from "@/pages/Contact";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import SecurityPage from "@/pages/SecurityPage";
import SecurityCenter from "@/pages/SecurityCenter";
import CompliancePage from "@/pages/CompliancePage";
import NotFound from "@/pages/not-found";
import { DevAuthNotice } from "@/components/DevAuthNotice";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function Router() {
  const { user } = useAuth();

  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login">
        {user ? <Redirect to="/dashboard" /> : <Login />}
      </Route>
      <Route path="/about" component={About} />
      <Route path="/blog" component={Blog} />
      <Route path="/careers" component={Careers} />
      <Route path="/contact" component={Contact} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/security" component={SecurityPage} />
      <Route path="/security-center">
        <ProtectedRoute component={SecurityCenter} />
      </Route>
      <Route path="/compliance-info" component={CompliancePage} />
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/threats">
        {() => <Redirect to="/security-center?tab=threats" />}
      </Route>
      <Route path="/map">
        <ProtectedRoute component={ThreatMap} />
      </Route>
      <Route path="/alerts">
        {() => <Redirect to="/security-center?tab=alerts" />}
      </Route>
      <Route path="/reports">
        <ProtectedRoute component={Reports} />
      </Route>
      <Route path="/subscription">
        <ProtectedRoute component={Subscription} />
      </Route>
      <Route path="/checkout">
        <ProtectedRoute component={Checkout} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={Settings} />
      </Route>
      <Route path="/virustotal">
        <ProtectedRoute component={VirusTotalScan} />
      </Route>
      <Route path="/event-sources">
        <ProtectedRoute component={EventSources} />
      </Route>
      <Route path="/install-guide">
        <ProtectedRoute component={InstallGuide} />
      </Route>
      <Route path="/network-activity">
        <ProtectedRoute component={NetworkActivity} />
      </Route>
      <Route path="/admin">
        <ProtectedRoute component={AdminDashboard} />
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute component={UserManagement} />
      </Route>
      <Route path="/admin/analytics">
        <ProtectedRoute component={SystemAnalytics} />
      </Route>
      <Route path="/admin/ip-blocklist">
        <ProtectedRoute component={IpBlocklistManagement} />
      </Route>
      <Route path="/admin/compliance">
        <ProtectedRoute component={Compliance} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { user, isAdmin } = useAuth();
  const { t } = useTranslation();
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };
  const [mfaOpen, setMfaOpen] = React.useState(false);
  React.useEffect(() => {
    const unsub = subscribeMfa(() => setMfaOpen(true));
    return unsub;
  }, []);

  // Dev-only: probe server for legacy cookie auth and surface a small badge
  const [devAuthInfo, setDevAuthInfo] = React.useState<{ cookieUserId?: string | null } | null>(null);
  React.useEffect(() => {
    if (import.meta.env.DEV) {
      fetch('/api/dev/whoami', { credentials: 'include' })
        .then(r => r.json())
        .then(data => setDevAuthInfo({ cookieUserId: data.cookieUserId }))
        .catch(() => setDevAuthInfo(null));
    }
  }, []);

  if (!user) {
    return <Router />;
  }

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-2 px-4 py-2 border-b bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              {import.meta.env.DEV && (
                <>
                  {devAuthInfo?.cookieUserId && (
                    <Badge variant="secondary" title="Using dev cookie auth">
                      Dev cookie: {devAuthInfo.cookieUserId}
                    </Badge>
                  )}
                  {isAdmin && (
                    <Badge variant="outline" title="Administrator privileges">
                      Admin
                    </Badge>
                  )}
                </>
              )}
              <GlobalSearch />
              <LanguageToggle />
              {/* Help button tour removed */}
              <ThemeToggle />
            </div>
          </header>
          <DevAuthNotice />
          <main className="flex-1 overflow-y-auto">
            <Router />
          </main>
        </div>
      </div>
      <MfaChallenge open={mfaOpen} onClose={() => setMfaOpen(false)} />
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <AppContent />
            <div id="recaptcha-container"></div>
            {/* Render controlled MFA challenge bound to global bus state */}
            {/* Note: We subscribe in AppContent; forward state via a render prop */}
            {/* Simpler: maintain a top-level state here as well */}
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
