import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  AlertTriangle, 
  ShieldCheck, 
  Bell,
  TrendingUp,
  Activity,
  Ban,
  ShieldOff
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Threat, Alert, ThreatEvent, UserPreferences, IpBlocklistEntry } from '@shared/schema';
import { format } from 'date-fns';
import SecurityKpiStrip from '@/components/security/SecurityKpiStrip';
import SeverityDistributionBar from '@/components/security/SeverityDistributionBar';
import SeverityDonutChart from '@/components/security/SeverityDonutChart';
import ThreatFiltersBar, { Severity as FilterSeverity } from '@/components/security/ThreatFiltersBar';
import { useFilteredThreats } from '@/hooks/useFilteredThreats';
import { useThreatFilters } from '@/hooks/useThreatFilters';
import AuthFailuresPanel from '@/components/security/AuthFailuresPanel';
import { useEffect, useMemo, useState } from 'react';
import { Redirect } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface DashboardStats {
  active: number;
  blocked: number;
  alerts: number;
}

interface BrowsingStats {
  totalVisits: number;
  uniqueDomains: number;
  flaggedDomains: number;
  browserBreakdown: Array<{ browser: string; count: number }>;
  topDomains: Array<{ domain: string; count: number }>;
}

interface TimelineDataPoint {
  time: string;
  threats: number;
}

interface PieChartDataPoint {
  name: string;
  value: number;
}

const SEVERITY_COLORS = {
  critical: 'hsl(var(--destructive))',
  high: 'hsl(27 87% 52%)',
  medium: 'hsl(43 96% 56%)',
  low: 'hsl(173 58% 39%)',
};


type Severity = FilterSeverity;
export default function Dashboard() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  // Tour removed: no onboarding logic
  const enabled = !!user;
  // Integrated expansion state for live threat feed card
  const [feedExpanded, setFeedExpanded] = useState(false);

  const { data: preferences } = useQuery<UserPreferences>({
    queryKey: ['/api/user/preferences'],
    enabled,
  });

  // Tour removed: previously auto-started tour based on preferences


  const monitoringMode = preferences?.monitoringMode || 'demo';

  const { data: stats = { active: 0, blocked: 0, alerts: 0 }, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/stats'],
    enabled: enabled && !!preferences, // Depend on preferences to know the mode
  });

  const { 
    data: recentThreats = [], 
    isLoading: threatsLoading,
    dataUpdatedAt: threatsUpdatedAt,
    isFetching: threatsFetching
  } = useQuery<(Threat | ThreatEvent)[]>({
    queryKey: ['/api/threats/recent'],
    enabled: enabled && !!preferences,
  });

  // Centralized filter state & persistence
  const {
    severityFilter,
    setSeverityFilter,
    typeFilter,
    setTypeFilter,
    typeFilterEffective,
    sourceInput,
    setSourceInput,
    sourceQuery,
    clearFilters,
    resetUrl,
    perTabScope,
    toggleScope,
  } = useThreatFilters(user?.uid);

  const typeOptions = useMemo(() => {
    const list = (recentThreats || []).map((th: any) => ('threatType' in th ? th.threatType : th.type)).filter(Boolean);
    return Array.from(new Set(list));
  }, [recentThreats]);

  // (Legacy inline filter state removed in favor of useThreatFilters)

  // Memoized filtered threats (used for both count badge and list rendering)
  const { filtered: filteredThreats, count: filteredThreatsCount } = useFilteredThreats(recentThreats, {
    severity: severityFilter,
    type: typeFilterEffective,
    sourceQuery,
  });
  const displayedThreats = useMemo(() => filteredThreats.slice(0, feedExpanded ? 40 : 10), [filteredThreats, feedExpanded]);

  const { data: alerts = [], isLoading: alertsLoading } = useQuery<Alert[]>({
    queryKey: ['/api/alerts/recent'],
    enabled: enabled && !!preferences,
  });

  const { data: timelineData = [] } = useQuery<TimelineDataPoint[]>({
    queryKey: ['/api/threats/timeline'],
    enabled: enabled && !!preferences,
  });

  const { data: typeDistribution = [] } = useQuery<PieChartDataPoint[]>({
    queryKey: ['/api/threats/by-type'],
    enabled: enabled && !!preferences,
  });

  const { data: browsingStats } = useQuery<BrowsingStats>({
    queryKey: ['api/browsing/stats'],
    enabled,
  });

  const { data: recentlyBlockedIps = [], isLoading: blockedIpsLoading } = useQuery<IpBlocklistEntry[]>({
    queryKey: ['/api/ip-blocklist/recent'],
    enabled: enabled && monitoringMode === 'real',
  });

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const statCards = [
    {
      title: t('dashboard.activeThreats'),
      value: stats.active || 0,
      icon: AlertTriangle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      testId: 'stat-active-threats'
    },
    {
      title: t('dashboard.threatsBlocked'),
      value: stats.blocked || 0,
      icon: ShieldCheck,
      color: 'text-chart-3',
      bgColor: 'bg-chart-3/10',
      testId: 'stat-threats-blocked'
    },
    {
      title: t('dashboard.alertsToday'),
      value: stats.alerts || 0,
      icon: Bell,
      color: 'text-chart-4',
      bgColor: 'bg-chart-4/10',
      testId: 'stat-alerts-today'
    },
    {
      title: t('dashboard.systemStatus'),
      value: t('dashboard.allSystemsOperational'),
      icon: Shield,
      color: 'text-chart-3',
      bgColor: 'bg-chart-3/10',
      isText: true,
      testId: 'stat-system-status'
    },
  ];

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" id="dashboard-page">
      <div>
        <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('app.tagline')}
        </p>
      </div>

      {/* KPI strip & severity distribution */}
      <div className="space-y-4">
        <SecurityKpiStrip />
        <div className="grid gap-4 md:grid-cols-2" aria-label="severity-overview">
          {/* Reordered: Donut first for quick proportional scan, bar second for detailed percentages */}
          <SeverityDonutChart selectedSeverity={severityFilter} onSelectSeverity={setSeverityFilter} />
          <SeverityDistributionBar selectedSeverity={severityFilter} onSelectSeverity={setSeverityFilter} />
        </div>
      </div>

      {/* Authentication failures panel (admin only; shows empty if unauthorized) */}
      <div>
        <AuthFailuresPanel />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card id="threat-feed-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {t('dashboard.threatTimeline')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="time" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="threats" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary) / 0.2)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                {statsLoading ? t('common.loading') : t('dashboard.noThreats')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.threatsByType')}</CardTitle>
          </CardHeader>
          <CardContent>
            {typeDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={typeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {typeDistribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                {statsLoading ? t('common.loading') : t('dashboard.noThreats')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {browsingStats && (browsingStats.totalVisits > 0 || browsingStats.uniqueDomains > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {t('dashboard.networkActivity')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t('dashboard.totalVisits')}</p>
                <p className="text-2xl font-bold" data-testid="stat-total-visits">{browsingStats.totalVisits.toLocaleString()}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t('dashboard.uniqueDomains')}</p>
                <p className="text-2xl font-bold" data-testid="stat-unique-domains">{browsingStats.uniqueDomains.toLocaleString()}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t('dashboard.flaggedDomains')}</p>
                <p className="text-2xl font-bold text-destructive" data-testid="stat-flagged-domains">{browsingStats.flaggedDomains.toLocaleString()}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t('dashboard.topBrowser')}</p>
                <p className="text-lg font-bold" data-testid="stat-top-browser">
                  {browsingStats.browserBreakdown?.[0]?.browser || 'N/A'}
                </p>
              </div>
            </div>
            {browsingStats.topDomains && browsingStats.topDomains.length > 0 && (
              <div className="mt-6 space-y-2">
                <p className="text-sm font-medium text-muted-foreground mb-3">{t('dashboard.topVisitedDomains')}</p>
                <div className="space-y-2">
                  {browsingStats.topDomains.slice(0, 5).map((domain: { domain: string; count: number }) => (
                    <div key={domain.domain} className="flex items-center justify-between text-sm">
                      <span className="font-mono truncate mr-4">{domain.domain}</span>
                      <Badge variant="secondary">{domain.count.toLocaleString()}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 items-stretch">
        <Card id="threat-feed-card" className={`flex flex-col transition-all ${feedExpanded ? 'md:col-span-2 h-[70vh]' : ''}`}>        
          <CardHeader>
            <CardTitle className="flex flex-col gap-2">
              <div className="flex items-center gap-2 w-full">
                <Activity className="h-5 w-5 text-destructive" />
                {t('dashboard.threatFeed')}
                <Badge variant="secondary" className="ml-auto" title="Filtered results shown">
                  {filteredThreatsCount}
                </Badge>
                <Badge variant="destructive">
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse mr-1.5" />
                  Live
                </Badge>
                <button
                  type="button"
                  onClick={() => setFeedExpanded(e => !e)}
                  className="ml-2 text-xs px-2 py-1 rounded border bg-background hover:bg-muted"
                >
                  {feedExpanded ? 'Collapse' : 'Expand'}
                </button>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {t('dashboard.lastUpdated')}: {threatsLoading ? t('common.loading') : format(new Date(threatsUpdatedAt), 'HH:mm:ss')}
                </span>
                {threatsFetching && !threatsLoading && (
                  <span className="flex items-center gap-1" title="Fetching latest threats">
                    <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
                    {t('common.loading')}
                  </span>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className={`flex flex-col flex-1 overflow-hidden ${feedExpanded ? 'min-h-0' : ''}`}>
            <ThreatFiltersBar
              className="mb-3"
              typeOptions={typeOptions}
              selectedType={typeFilter}
              onSelectType={setTypeFilter}
              sourceQuery={sourceInput}
              onSourceQueryChange={setSourceInput}
              selectedSeverity={severityFilter}
              onSelectSeverity={setSeverityFilter}
              onClearAll={clearFilters}
              onCopyLink={() => {
                try {
                  const url = window.location.href;
                  navigator.clipboard.writeText(url);
                  toast({ title: 'Link copied', description: 'Current filters have been copied to your clipboard.' });
                } catch {}
              }}
              onResetDefaults={resetUrl}
              perTabScope={perTabScope}
              onToggleScope={toggleScope}
            />
            <div className="space-y-3 flex-1 overflow-y-auto">
              {threatsLoading ? (
                <p className="text-muted-foreground text-center py-8">{t('common.loading')}</p>
              ) : filteredThreats.length > 0 ? (
                displayedThreats.map((threat) => {
                  const isRealThreat = 'threatType' in threat;
                  const timestamp = isRealThreat ? (threat as ThreatEvent).createdAt : (threat as Threat).timestamp;
                  const description = isRealThreat ? `[${threat.threatType}] ${threat.sourceURL || threat.deviceName || 'Unknown source'}` : threat.description;
                  const sourceIP = isRealThreat ? (threat as any).sourceIP || 'N/A' : (threat as Threat).sourceIP;
                  const targetIP = isRealThreat ? (threat as any).destinationIP || 'N/A' : (threat as Threat).targetIP;

                  return (<div
                    key={threat.id}
                    className="flex items-start gap-3 p-3 rounded-lg border hover-elevate"
                    data-testid={`threat-${threat.id}`}
                  >
                    <div className={`h-2 w-2 rounded-full mt-2 ${
                      threat.severity === 'critical' ? 'bg-destructive' :
                      threat.severity === 'high' ? SEVERITY_COLORS.high :
                      threat.severity === 'medium' ? SEVERITY_COLORS.medium : SEVERITY_COLORS.low
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={getSeverityBadgeVariant(threat.severity)} className="text-xs">
                          {t(`threats.severityLevels.${threat.severity}`)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(timestamp), 'HH:mm:ss')}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate">{description}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-1">
                        {sourceIP} → {targetIP}
                      </p>
                    </div>
                  </div>)
                })
              ) : (
                <p className="text-muted-foreground text-center py-8">{t('dashboard.noThreats')}</p>
              )}
            </div>
          </CardContent>
  </Card>

        {monitoringMode === 'real' && (
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="h-5 w-5" />
                {t('dashboard.recentlyBlockedIps')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 overflow-hidden">
              <div className="space-y-3 flex-1 overflow-y-auto">
                {blockedIpsLoading ? (
                  <p className="text-muted-foreground text-center py-8">{t('common.loading')}</p>
                ) : recentlyBlockedIps.length > 0 ? (
                  recentlyBlockedIps.map((ip) => (
                    <div
                      key={ip.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border"
                      data-testid={`blocked-ip-${ip.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {ip.countryCode && (
                            <img src={`https://flagcdn.com/w20/${ip.countryCode.toLowerCase()}.png`} alt={ip.countryCode} className="h-4 rounded-sm" />
                          )}
                          <p className="text-sm font-medium font-mono">{ip.ipAddress}</p>
                        </div>
                        <p className="text-xs text-muted-foreground truncate" title={ip.reason || ''}>
                          {ip.reason}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(ip.createdAt), 'HH:mm')}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    {t('dashboard.noBlockedIps')}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t('dashboard.recentAlerts')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 overflow-hidden">
            <div className="space-y-3 flex-1 overflow-y-auto">
              {alertsLoading ? (
                <p className="text-muted-foreground text-center py-8">{t('common.loading')}</p>
              ) : alerts.length > 0 ? (
                alerts.slice(0, 10).map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border ${alert.read ? 'opacity-60' : ''} hover-elevate`}
                    data-testid={`alert-${alert.id}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-medium">{alert.title}</p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(alert.timestamp), 'HH:mm')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{alert.message}</p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">{t('alerts.noAlerts')}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Removed separate ExpandedThreatFeed component; integrated expansion into main card */}
    </div>
  );
}
