import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Globe, Filter, Trash2, Search, Calendar, Chrome, AlertCircle, Activity, Zap, Info } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Pie, PieChart, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line } from 'recharts';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation } from '@tanstack/react-query';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface BrowsingActivity {
  id: number;
  userId: string;
  domain: string;
  url: string;
  ipAddress: string | null;
  browserType: string;
  timestamp: string;
  isFlagged: boolean;
  metadata: Record<string, any> | null;
}

interface BrowsingStats {
  totalVisits: number;
  uniqueDomains: number;
  flaggedDomains: number;
  browserBreakdown: Array<{ browser: string; count: number }>;
  topDomains: Array<{ domain: string; count: number }>;
}

export default function NetworkActivity() {
  const { t } = useTranslation();
  const [domainFilter, setDomainFilter] = useState('');
  const [ipFilter, setIpFilter] = useState('');
  const [browserFilter, setBrowserFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  // Load user preferences to initialize persistent UI defaults
  const { data: userPrefs } = useQuery<any>({ queryKey: ['/api/user/preferences'] });
  useEffect(() => {
    if (userPrefs && typeof userPrefs.flaggedOnlyDefault === 'boolean') {
      setFlaggedOnly(!!userPrefs.flaggedOnlyDefault);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('networkActivity.flaggedOnly', userPrefs.flaggedOnlyDefault ? 'true' : 'false');
      }
      return;
    }
    // Fallback to localStorage if server prefs not available
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('networkActivity.flaggedOnly');
      if (stored === 'true') setFlaggedOnly(true);
      if (stored === 'false') setFlaggedOnly(false);
    }
  }, [userPrefs]);

  // Mirror to localStorage for quick UX
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('networkActivity.flaggedOnly', flaggedOnly ? 'true' : 'false');
    }
  }, [flaggedOnly]);
  // Flow filters
  const [flowSeverity, setFlowSeverity] = useState<string>('all');
  const [flowProtocol, setFlowProtocol] = useState<string>('all');
  const [flowWindow, setFlowWindow] = useState<'15m' | '1h' | '24h'>('1h');
  const [pendingFlagDomain, setPendingFlagDomain] = useState<string | null>(null);

  const { data: activities = [], isLoading, refetch } = useQuery<BrowsingActivity[]>({
    queryKey: ['/api/browsing'],
  });

  const { data: stats } = useQuery<BrowsingStats>({
    queryKey: ['/api/browsing/stats'],
  });

  interface NetworkFlowEvent {
    id: string;
    timestamp: string;
    severity: string;
    eventType: string;
    sourceIP: string;
    destinationIP: string;
    protocol: string | null;
    action: string | null;
    message: string | null;
  }

  // Poll network flow (normalized events) every 10s
  const { data: networkFlow = [], isLoading: flowLoading } = useQuery<NetworkFlowEvent[]>({
    queryKey: ['/api/network/flow'],
    refetchInterval: 10000,
  });

  const generateFlow = useMutation({
    mutationFn: async (count: number) => {
      await apiRequest('POST', '/api/network/flow/generate', { count });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/network/flow'] });
    }
  });

  // Persist preference server-side on change
  const savePrefs = useMutation({
    mutationFn: async (value: boolean) => {
      await apiRequest('PUT', '/api/user/preferences', { flaggedOnlyDefault: value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/preferences'] });
    }
  });

  // Flag domain action
  const flagDomainMut = useMutation({
    mutationFn: async (domain: string) => {
      setPendingFlagDomain(domain);
      await apiRequest('POST', '/api/browsing/flag', { domain });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/browsing'] });
      queryClient.invalidateQueries({ queryKey: ['/api/browsing/stats'] });
    },
    onSettled: () => {
      setPendingFlagDomain(null);
    }
  });


  // Apply flow filters
  const filteredFlow = useMemo(() => {
    const now = Date.now();
    const windowMs = flowWindow === '15m' ? 15 * 60 * 1000 : flowWindow === '1h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    return networkFlow.filter(e => {
      const ts = new Date(e.timestamp).getTime();
      if (isNaN(ts) || ts < now - windowMs) return false;
      if (flowSeverity !== 'all' && (e.severity || '').toLowerCase() !== flowSeverity) return false;
      if (flowProtocol !== 'all' && (e.protocol || '').toLowerCase() !== flowProtocol.toLowerCase()) return false;
      return true;
    });
  }, [networkFlow, flowSeverity, flowProtocol, flowWindow]);

  // Aggregations derived from filteredFlow
  const severityData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of filteredFlow) {
      const key = (e.severity || 'unknown').toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredFlow]);

  const protocolData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of filteredFlow) {
      const key = (e.protocol || 'other').toUpperCase();
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts).map(([protocol, count]) => ({ protocol, count }));
  }, [filteredFlow]);

  const topSources = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of filteredFlow) {
      const key = e.sourceIP || 'unknown';
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredFlow]);

  const timelineData = useMemo(() => {
    const now = Date.now();
    const bucketSizeMs = flowWindow === '15m' ? 60 * 1000 : flowWindow === '1h' ? 5 * 60 * 1000 : 60 * 60 * 1000;
    const bucketCount = flowWindow === '15m' ? 15 : flowWindow === '1h' ? 12 : 24;
    const buckets: { start: number; label: string; count: number }[] = [];
    for (let i = bucketCount - 1; i >= 0; i--) {
      const start = now - i * bucketSizeMs;
      const d = new Date(start);
      const label = flowWindow === '24h' ? `${d.getHours().toString().padStart(2, '0')}:00` : `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      buckets.push({ start, label, count: 0 });
    }
    for (const e of filteredFlow) {
      const ts = new Date(e.timestamp).getTime();
      if (isNaN(ts)) continue;
      const idx = Math.min(
        buckets.length - 1,
        Math.floor((ts - (now - bucketCount * bucketSizeMs)) / bucketSizeMs)
      );
      if (idx >= 0 && idx < buckets.length) buckets[idx].count += 1;
    }
    return buckets.map(b => ({ time: b.label, count: b.count }));
  }, [filteredFlow, flowWindow]);

  const filteredActivities = activities.filter(activity => {
    if (domainFilter && !activity.domain.toLowerCase().includes(domainFilter.toLowerCase())) {
      return false;
    }
    if (ipFilter) {
      if (!activity.ipAddress || !activity.ipAddress.toLowerCase().includes(ipFilter.toLowerCase())) {
        return false;
      }
    }
    if (browserFilter !== 'all' && activity.browserType !== browserFilter) {
      return false;
    }
    if (flaggedOnly && !activity.isFlagged) {
      return false;
    }
    if (dateFrom) {
      const activityDate = new Date(activity.timestamp);
      const fromDate = new Date(dateFrom);
      if (activityDate < fromDate) {
        return false;
      }
    }
    if (dateTo) {
      const activityDate = new Date(activity.timestamp);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (activityDate > toDate) {
        return false;
      }
    }
    return true;
  });

  const getBrowserIcon = (browser: string) => {
    const lowerBrowser = browser.toLowerCase();
    if (lowerBrowser.includes('chrome')) return Chrome;
    return Globe;
  };

  const uniqueBrowsers = Array.from(new Set(activities.map(a => a.browserType)));

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('networkActivity.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('networkActivity.description')}
        </p>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">
                {t('dashboard.totalVisits')}
              </CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="total-visits">
                {stats.totalVisits?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">
                {t('dashboard.uniqueDomains')}
              </CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="unique-domains">
                {stats.uniqueDomains?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">
                {t('dashboard.flaggedDomains')}
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive" data-testid="flagged-domains">
                {stats.flaggedDomains?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">
                {t('dashboard.topBrowser')}
              </CardTitle>
              <Chrome className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold" data-testid="top-browser">
                {stats.browserBreakdown?.[0]?.browser || 'N/A'}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t('networkActivity.filters')}
          </CardTitle>
          <CardDescription>{t('networkActivity.filtersDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('networkActivity.searchDomain')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('networkActivity.searchDomainPlaceholder')}
                  value={domainFilter}
                  onChange={(e) => setDomainFilter(e.target.value)}
                  className="pl-9"
                  data-testid="input-domain-filter"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('networkActivity.searchIp')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('networkActivity.searchIpPlaceholder')}
                  value={ipFilter}
                  onChange={(e) => setIpFilter(e.target.value)}
                  className="pl-9"
                  data-testid="input-ip-filter"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('networkActivity.filterBrowser')}</label>
              <Select value={browserFilter} onValueChange={setBrowserFilter}>
                <SelectTrigger data-testid="select-browser-filter">
                  <SelectValue placeholder={t('networkActivity.allBrowsers')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('networkActivity.allBrowsers')}</SelectItem>
                  {uniqueBrowsers.map(browser => (
                    <SelectItem key={browser} value={browser}>{browser}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('networkActivity.dateFrom')}</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                data-testid="input-date-from"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('networkActivity.dateTo')}</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                data-testid="input-date-to"
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setDomainFilter('');
                  setIpFilter('');
                  setBrowserFilter('all');
                  setDateFrom('');
                  setDateTo('');
                  setFlaggedOnly(false);
                  savePrefs.mutate(false);
                }}
                className="w-full"
                data-testid="button-clear-filters"
              >
                {t('networkActivity.clearFilters')}
              </Button>
            </div>
            <div className="flex items-end">
              <div className="inline-flex items-center gap-2 text-sm">
                <Checkbox id="flagged-only" checked={flaggedOnly} onCheckedChange={(v) => { const next = Boolean(v); setFlaggedOnly(next); savePrefs.mutate(next); }} />
                <span>{t('networkActivity.flaggedOnly') || 'Flagged only'}</span>
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Flagged only info" className="text-muted-foreground hover:text-foreground inline-flex">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {t('networkActivity.flaggedOnlyTooltip') || 'Show only flagged browsing entries. This preference is saved to your account.'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {t('networkActivity.networkFlow') || 'Network Flow'}
          </CardTitle>
          <CardDescription>
            {t('networkActivity.networkFlowDescription') || 'Recent normalized events (live network flow).'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Flow Filters */}
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('threats.severity') || 'Severity'}</label>
              <Select value={flowSeverity} onValueChange={setFlowSeverity}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('networkActivity.protocol') || 'Protocol'}</label>
              <Select value={flowProtocol} onValueChange={setFlowProtocol}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="tcp">TCP</SelectItem>
                  <SelectItem value="udp">UDP</SelectItem>
                  <SelectItem value="icmp">ICMP</SelectItem>
                  <SelectItem value="http">HTTP</SelectItem>
                  <SelectItem value="https">HTTPS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('networkActivity.timeWindow') || 'Time window'}</label>
              <Select value={flowWindow} onValueChange={(v) => setFlowWindow(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15m">Last 15 minutes</SelectItem>
                  <SelectItem value="1h">Last hour</SelectItem>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                className="w-full"
                variant="outline"
                disabled={generateFlow.isPending}
                onClick={() => generateFlow.mutate(40)}
              >
                {generateFlow.isPending ? 'Generating…' : 'Generate sample flow'}
              </Button>
            </div>
          </div>

          {/* Analytics Row */}
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            {/* Severity Distribution */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="text-sm">{t('networkActivity.severityDistribution') || 'Severity distribution'}</CardTitle>
              </CardHeader>
              <CardContent>
                {severityData.length === 0 ? (
                  <div className="text-sm text-muted-foreground">{t('common.noData') || 'No data'}</div>
                ) : (
                  <ChartContainer config={{}} className="h-48">
                    <PieChart>
                      <Pie data={severityData} dataKey="value" nameKey="name" outerRadius={70}>
                        {severityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"][index % 5]} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Protocol Distribution */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="text-sm">{t('networkActivity.protocolDistribution') || 'Protocol distribution'}</CardTitle>
              </CardHeader>
              <CardContent>
                {protocolData.length === 0 ? (
                  <div className="text-sm text-muted-foreground">{t('common.noData') || 'No data'}</div>
                ) : (
                  <ChartContainer config={{}} className="h-48">
                    <BarChart data={protocolData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="protocol" />
                      <YAxis allowDecimals={false} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4,4,0,0]} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Top Source IPs */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="text-sm">{t('networkActivity.topSources') || 'Top source IPs'}</CardTitle>
              </CardHeader>
              <CardContent>
                {topSources.length === 0 ? (
                  <div className="text-sm text-muted-foreground">{t('common.noData') || 'No data'}</div>
                ) : (
                  <div className="space-y-2">
                    {topSources.map((row) => (
                      <div key={row.ip} className="flex items-center justify-between text-sm font-mono">
                        <span className="truncate mr-2">{row.ip}</span>
                        <Badge variant="secondary">{row.count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Timeline */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-sm">{t('networkActivity.timeline') || 'Event timeline'}</CardTitle>
            </CardHeader>
            <CardContent>
              {timelineData.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t('common.noData') || 'No data'}</div>
              ) : (
                <ChartContainer config={{}} className="h-56">
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis allowDecimals={false} />
                    <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {flowLoading ? (
            <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
          ) : networkFlow.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('networkActivity.noFlowData') || 'No Flow Data'}</AlertTitle>
              <AlertDescription>
                {t('networkActivity.noFlowDataDescription') || 'No normalized events have been recorded yet.'}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto" data-testid="network-flow-list">
              {filteredFlow.map(ev => (
                <div key={ev.id} className="flex items-start gap-3 p-3 rounded-lg border hover-elevate">
                  <Zap className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs">{ev.sourceIP} ➜ {ev.destinationIP}</span>
                      <Badge variant="secondary" className="text-xs">{ev.protocol || 'n/a'}</Badge>
                      <Badge variant={ev.severity === 'critical' ? 'destructive' : ev.severity === 'high' ? 'default' : 'outline'} className="text-xs">
                        {ev.severity}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {format(new Date(ev.timestamp), 'HH:mm:ss')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">{ev.eventType} {ev.action ? `(${ev.action})` : ''}</p>
                    {ev.message && (
                      <p className="text-xs text-muted-foreground truncate" title={ev.message}>{ev.message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('networkActivity.browsingHistory')}
          </CardTitle>
          <CardDescription>
            {filteredActivities.length} {t('networkActivity.recordsFound')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : filteredActivities.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('networkActivity.noData')}</AlertTitle>
              <AlertDescription>
                {t('networkActivity.noDataDescription')}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredActivities.map((activity) => {
                const BrowserIcon = getBrowserIcon(activity.browserType);
                return (
                  <div
                    key={activity.id}
                    className={
                      `flex items-start gap-3 p-4 rounded-lg border hover-elevate ` +
                      (activity.isFlagged ? 'border-destructive/40 bg-destructive/5 ring-1 ring-destructive/20' : '')
                    }
                    data-testid={`activity-${activity.id}`}
                  >
                    <BrowserIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <p className={`font-medium font-mono text-sm truncate ${activity.isFlagged ? 'text-destructive' : ''}`}>
                          {activity.domain}
                        </p>
                        {activity.isFlagged && (
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="destructive" className="text-xs cursor-default">
                                  {t('networkActivity.flagged')}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {t('networkActivity.flaggedTooltip') || 'This domain is flagged. Flagging highlights it and counts toward flagged stats.'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {activity.browserType}
                        </Badge>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {format(new Date(activity.timestamp), 'PPp')}
                        </span>
                        {!activity.isFlagged && (
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2"
                                  disabled={flagDomainMut.isPending && pendingFlagDomain === activity.domain}
                                  onClick={() => flagDomainMut.mutate(activity.domain)}
                                >
                                  {flagDomainMut.isPending && pendingFlagDomain === activity.domain
                                    ? t('networkActivity.flagging') || 'Flagging...'
                                    : t('networkActivity.flagDomain') || 'Flag domain'}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {t('networkActivity.flagDomainTooltip') || 'Mark this domain as flagged to highlight it and include it in flagged stats.'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      {activity.url && activity.url !== activity.domain && (
                        <p className="text-xs text-muted-foreground font-mono mb-1 truncate">
                          {activity.url}
                        </p>
                      )}
                      {activity.ipAddress && (
                        <p className="text-xs text-muted-foreground">
                          IP: {activity.ipAddress}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
