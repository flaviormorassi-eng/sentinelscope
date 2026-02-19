import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Globe, Filter, Trash2, Search, Calendar, Chrome, AlertCircle, Activity, Zap, Info } from 'lucide-react';
import { useMemo, useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Pie, PieChart, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line } from 'recharts';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation } from '@tanstack/react-query';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { BotTrafficChart } from '@/components/BotTrafficChart';
import { useToast } from '@/hooks/use-toast';
import { useLocation, useSearch } from 'wouter';

interface BrowsingActivity {
  id: string;
  userId: string;
  domain: string;
  fullUrl: string | null;
  ipAddress: string | null;
  browser: string;
  detectedAt: string;
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
  const { toast } = useToast();
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const tx = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const [domainFilter, setDomainFilter] = useState('');
  const [ipFilter, setIpFilter] = useState('');
  const [browserFilter, setBrowserFilter] = useState('all');
  const [classificationFilter, setClassificationFilter] = useState<'all' | 'local-safe' | 'public-external' | 'needs-review'>('all');
  const [viewMode, setViewMode] = useState<'all' | 'flow' | 'history'>('all');
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
  const [flowWindow, setFlowWindow] = useState<'15m' | '1h' | '24h'>('24h');
  const [flowSourceFilter, setFlowSourceFilter] = useState('');
  const [flowSuspiciousOnly, setFlowSuspiciousOnly] = useState(false);
  const [flowListMode, setFlowListMode] = useState<'events' | 'sources'>('events');
  const [pendingFlagDomain, setPendingFlagDomain] = useState<string | null>(null);
  const focusedFlowRowRef = useRef<HTMLDivElement | null>(null);
  const focusedSourceCardRef = useRef<HTMLDivElement | null>(null);

  const focusSourceIp = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return (params.get('focusSourceIp') || params.get('sourceIp') || '').trim().toLowerCase();
  }, [searchString]);

  const focusedThreatId = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return (params.get('threatId') || '').trim();
  }, [searchString]);

  const focusedAlertId = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return (params.get('alertId') || '').trim();
  }, [searchString]);

  const navigationContext = useMemo(() => {
    const params = new URLSearchParams(searchString);
    const from = (params.get('from') || '').trim();
    const src = (params.get('sourceIp') || params.get('focusSourceIp') || '').trim();
    const threatId = (params.get('threatId') || '').trim();
    const alertId = (params.get('alertId') || '').trim();

    const alertsParams = new URLSearchParams();
    alertsParams.set('tab', 'alerts');
    alertsParams.set('from', 'flow');
    if (alertId) alertsParams.set('alertId', alertId);
    if (threatId) alertsParams.set('threatId', threatId);
    if (src) alertsParams.set('src', src);
    const alertsHref = `/security-center?${alertsParams.toString()}`;

    const threatsParams = new URLSearchParams();
    threatsParams.set('tab', 'threats');
    threatsParams.set('from', 'flow');
    if (threatId) threatsParams.set('threatId', threatId);
    if (src) threatsParams.set('src', src);
    const threatsHref = `/security-center?${threatsParams.toString()}`;

    const mapParams = new URLSearchParams();
    if (src) mapParams.set('sourceIp', src);
    if (threatId) mapParams.set('threatId', threatId);
    if (alertId) mapParams.set('alertId', alertId);
    const mapHref = mapParams.toString() ? `/map?${mapParams.toString()}` : '/map';

    const returnHref = from === 'alerts' ? alertsHref : from === 'threats' ? threatsHref : from === 'map' ? mapHref : '';
    const returnLabel = from === 'alerts'
      ? tx('networkActivity.returnToAlerts', 'Return to Alerts')
      : from === 'threats'
        ? tx('networkActivity.returnToThreatLog', 'Return to Threat Log')
        : from === 'map'
          ? tx('networkActivity.returnToThreatMap', 'Return to Threat Map')
          : '';

    return { from, alertId, threatId, alertsHref, threatsHref, mapHref, returnHref, returnLabel };
  }, [searchString]);

  // Support deep links back into flow triage context
  useEffect(() => {
    const params = new URLSearchParams(searchString);

    const view = params.get('view');
    if (view === 'all' || view === 'flow' || view === 'history') {
      setViewMode(view);
    }

    const sourceIp = (params.get('sourceIp') || '').trim();
    if (sourceIp) setFlowSourceFilter(sourceIp);

    const windowParam = params.get('window');
    if (windowParam === '15m' || windowParam === '1h' || windowParam === '24h') {
      setFlowWindow(windowParam);
    }

    const suspicious = params.get('suspicious');
    if (suspicious === '1' || suspicious === 'true') {
      setFlowSuspiciousOnly(true);
    }
  }, [searchString]);

  const { data: activities = [], isLoading, refetch } = useQuery<BrowsingActivity[]>({
    queryKey: ['/api/browsing/activity?limit=5000'],
    refetchInterval: 5000,
  });

  const { data: stats } = useQuery<BrowsingStats>({
    queryKey: ['/api/browsing/stats'],
    refetchInterval: 10000,
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

  interface FlowAnomalyInfo {
    event: NetworkFlowEvent;
    isSuspicious: boolean;
    repeatedSource: boolean;
    unusualProtocol: boolean;
    externalHighSeverity: boolean;
    riskScore: number;
  }

  // Poll network flow (normalized events) every 5s
  const { data: networkFlow = [], isLoading: flowLoading } = useQuery<NetworkFlowEvent[]>({
    queryKey: ['/api/network/flow'],
    refetchInterval: 5000,
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
      if (flowSourceFilter && !(e.sourceIP || '').toLowerCase().includes(flowSourceFilter.toLowerCase())) return false;
      return true;
    });
  }, [networkFlow, flowSeverity, flowProtocol, flowWindow, flowSourceFilter]);

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

  const flowSummary = useMemo(() => {
    const protocolKinds = new Set(filteredFlow.map(e => (e.protocol || 'other').toLowerCase())).size;
    const severities = new Set(filteredFlow.map(e => (e.severity || 'unknown').toLowerCase())).size;
    const latestTs = filteredFlow.length ? filteredFlow[0]?.timestamp : null;
    return {
      events: filteredFlow.length,
      protocolKinds,
      severities,
      latestTs,
    };
  }, [filteredFlow]);

  const getBrowserIcon = (browser: string) => {
    const lowerBrowser = (browser || '').toLowerCase();
    if (lowerBrowser.includes('chrome')) return Chrome;
    return Globe;
  };

  const getProviderInfo = (domain: string) => {
    if (!domain) return null;
    const d = domain.toLowerCase();
    if (d.includes('amazonaws.com')) return { name: 'Amazon AWS', color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200' };
    if (d.includes('1e100.net') || d.includes('googleusercontent') || d.includes('google')) return { name: 'Google Cloud', color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' };
    if (d.includes('azure') || d.includes('microsoft')) return { name: 'Microsoft Azure', color: 'text-sky-600', bg: 'bg-sky-100', border: 'border-sky-200' };
    if (d.includes('fastly')) return { name: 'Fastly CDN', color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-200' };
    if (d.includes('cloudflare')) return { name: 'Cloudflare', color: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-200' };
    if (d.includes('facebook') || d.includes('fbcdn')) return { name: 'Meta', color: 'text-blue-700', bg: 'bg-blue-100', border: 'border-blue-200' };
    if (d.includes('apple') || d.includes('icloud')) return { name: 'Apple', color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200' };
    return null;
  };

  const isPrivateOrLocalIp = (ip?: string | null) => {
    if (!ip) return false;
    const v = ip.trim().toLowerCase();
    if (!v) return false;

    // IPv4 local/private/link-local/loopback
    if (/^(10\.|127\.|192\.168\.|169\.254\.)/.test(v)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(v)) return true;

    // IPv6 local/link-local/loopback
    if (v === '::1') return true;
    if (v.startsWith('fe80:') || v.startsWith('fc') || v.startsWith('fd')) return true;

    return false;
  };

  const isLocalHostLike = (domain?: string | null) => {
    if (!domain) return false;
    const d = domain.trim().toLowerCase();
    return d === 'localhost' || d.endsWith('.local');
  };

  const getEntryClassification = (activity: BrowsingActivity) => {
    if (activity.isFlagged) {
      return {
        key: 'needs-review',
        label: tx('networkActivity.needsReview', 'Needs review'),
        className: 'bg-destructive/10 text-destructive border-destructive/30',
      };
    }

    if (isPrivateOrLocalIp(activity.ipAddress) || isLocalHostLike(activity.domain)) {
      return {
        key: 'local-safe',
        label: tx('networkActivity.localSafe', 'Local-safe'),
        className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
      };
    }

    return {
      key: 'public-external',
      label: tx('networkActivity.publicExternal', 'Public-external'),
      className: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
    };
  };

  const flowAnomalyData = useMemo<FlowAnomalyInfo[]>(() => {
    const sourceCounts: Record<string, number> = {};
    const protocolCounts: Record<string, number> = {};

    for (const e of filteredFlow) {
      const source = (e.sourceIP || 'unknown').trim().toLowerCase();
      const protocol = (e.protocol || 'other').trim().toLowerCase();
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
      protocolCounts[protocol] = (protocolCounts[protocol] || 0) + 1;
    }

    const total = Math.max(filteredFlow.length, 1);

    return filteredFlow.map((e) => {
      const sev = (e.severity || '').toLowerCase();
      const source = (e.sourceIP || 'unknown').trim().toLowerCase();
      const protocol = (e.protocol || 'other').trim().toLowerCase();
      const sourceCount = sourceCounts[source] || 0;
      const protocolCount = protocolCounts[protocol] || 0;

      const repeatedSource = sourceCount >= 5;
      const unusualProtocol = protocolCount <= 2 && total >= 10;
      const externalHighSeverity = !isPrivateOrLocalIp(e.sourceIP) && (sev === 'critical' || sev === 'high');

      const riskScore =
        (sev === 'critical' ? 4 : sev === 'high' ? 3 : sev === 'medium' ? 2 : 1) +
        (repeatedSource ? 2 : 0) +
        (unusualProtocol ? 1 : 0) +
        (externalHighSeverity ? 2 : 0);

      return {
        event: e,
        isSuspicious: repeatedSource || unusualProtocol || externalHighSeverity || sev === 'critical' || sev === 'high',
        repeatedSource,
        unusualProtocol,
        externalHighSeverity,
        riskScore,
      };
    });
  }, [filteredFlow]);

  const visibleFlow = useMemo(() => {
    const rows = flowSuspiciousOnly
      ? flowAnomalyData.filter((row) => row.isSuspicious)
      : flowAnomalyData;
    return rows.sort((a, b) => {
      if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
      return new Date(b.event.timestamp).getTime() - new Date(a.event.timestamp).getTime();
    });
  }, [flowAnomalyData, flowSuspiciousOnly]);

  const suspiciousSummary = useMemo(() => {
    let suspicious = 0;
    let repeated = 0;
    let unusualProto = 0;
    let externalHigh = 0;

    for (const row of flowAnomalyData) {
      if (row.isSuspicious) suspicious += 1;
      if (row.repeatedSource) repeated += 1;
      if (row.unusualProtocol) unusualProto += 1;
      if (row.externalHighSeverity) externalHigh += 1;
    }

    return { suspicious, repeated, unusualProto, externalHigh };
  }, [flowAnomalyData]);

  const groupedFlowSources = useMemo(() => {
    const groups: Record<string, {
      sourceIP: string;
      count: number;
      suspiciousCount: number;
      firstSeenTs: number;
      lastSeenTs: number;
      maxRisk: number;
      maxSeverityWeight: number;
      protocols: Record<string, number>;
    }> = {};

    const severityWeight = (severity?: string | null) => {
      const s = (severity || '').toLowerCase();
      if (s === 'critical') return 4;
      if (s === 'high') return 3;
      if (s === 'medium') return 2;
      return 1;
    };

    for (const row of visibleFlow) {
      const ev = row.event;
      const key = ev.sourceIP || 'unknown';
      const ts = new Date(ev.timestamp).getTime();
      const safeTs = Number.isNaN(ts) ? Date.now() : ts;
      const protocol = (ev.protocol || 'other').toUpperCase();

      if (!groups[key]) {
        groups[key] = {
          sourceIP: key,
          count: 0,
          suspiciousCount: 0,
          firstSeenTs: safeTs,
          lastSeenTs: safeTs,
          maxRisk: 0,
          maxSeverityWeight: 0,
          protocols: {},
        };
      }

      const group = groups[key];
      group.count += 1;
      if (row.isSuspicious) group.suspiciousCount += 1;
      group.firstSeenTs = Math.min(group.firstSeenTs, safeTs);
      group.lastSeenTs = Math.max(group.lastSeenTs, safeTs);
      group.maxRisk = Math.max(group.maxRisk, row.riskScore);
      group.maxSeverityWeight = Math.max(group.maxSeverityWeight, severityWeight(ev.severity));
      group.protocols[protocol] = (group.protocols[protocol] || 0) + 1;
    }

    return Object.values(groups)
      .map((group) => ({
        ...group,
        topProtocols: Object.entries(group.protocols)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([protocol]) => protocol),
      }))
      .sort((a, b) => {
        if (b.maxRisk !== a.maxRisk) return b.maxRisk - a.maxRisk;
        if (b.suspiciousCount !== a.suspiciousCount) return b.suspiciousCount - a.suspiciousCount;
        return b.count - a.count;
      });
  }, [visibleFlow]);

  useEffect(() => {
    if (!focusSourceIp) return;
    const target = flowListMode === 'sources' ? focusedSourceCardRef.current : focusedFlowRowRef.current;
    if (!target) return;

    try {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
      // noop
    }
  }, [focusSourceIp, flowListMode, visibleFlow.length, groupedFlowSources.length]);

  const handleFilterBySource = (sourceIP: string) => {
    if (!sourceIP || sourceIP === 'unknown') return;
    setFlowSourceFilter(sourceIP);
    setFlowListMode('events');
    toast({
      title: tx('networkActivity.sourceFilterAppliedTitle', 'Source filter applied'),
      description: tx('networkActivity.sourceFilterAppliedDescription', 'Flow list filtered by selected source IP.'),
    });
  };

  const handleCopySourceIp = async (sourceIP: string) => {
    if (!sourceIP || sourceIP === 'unknown') return;
    try {
      await navigator.clipboard.writeText(sourceIP);
      toast({
        title: tx('networkActivity.ipCopiedTitle', 'IP copied'),
        description: tx('networkActivity.ipCopiedDescription', 'Source IP copied to clipboard.'),
      });
    } catch {
      toast({
        title: tx('networkActivity.copyFailedTitle', 'Copy failed'),
        description: tx('networkActivity.copyFailedDescription', 'Unable to copy IP to clipboard.'),
        variant: 'destructive',
      });
    }
  };

  const handleOpenThreatMap = (sourceIP?: string) => {
    const params = new URLSearchParams();
    params.set('from', 'flow');
    if (sourceIP && sourceIP !== 'unknown') params.set('sourceIp', sourceIP);
    if (focusedThreatId) params.set('threatId', focusedThreatId);
    if (navigationContext.alertId) params.set('alertId', navigationContext.alertId);
    setLocation(`/map?${params.toString()}`);
  };

  const handleOpenThreatLog = (sourceIP?: string) => {
    const qp = sourceIP && sourceIP !== 'unknown' ? `&src=${encodeURIComponent(sourceIP)}` : '';
    const returnSource = sourceIP && sourceIP !== 'unknown' ? `&returnSourceIp=${encodeURIComponent(sourceIP)}` : '';
    const returnSuspicious = flowSuspiciousOnly ? '&returnSuspicious=1' : '';
    const alert = navigationContext.alertId ? `&alertId=${encodeURIComponent(navigationContext.alertId)}` : '';
    setLocation(`/security-center?tab=threats&from=flow${qp}&returnView=flow&returnWindow=${flowWindow}${returnSuspicious}${returnSource}${alert}`);
  };

  const handleOpenAlerts = (sourceIP?: string) => {
    const src = sourceIP && sourceIP !== 'unknown' ? `&src=${encodeURIComponent(sourceIP)}` : '';
    const threat = focusedThreatId ? `&threatId=${encodeURIComponent(focusedThreatId)}` : '';
    const alert = navigationContext.alertId ? `&alertId=${encodeURIComponent(navigationContext.alertId)}` : '';
    setLocation(`/security-center?tab=alerts&from=flow${src}${threat}${alert}`);
  };

  const filteredActivities = activities.filter(activity => {
    const classification = getEntryClassification(activity);

    if (domainFilter && !activity.domain.toLowerCase().includes(domainFilter.toLowerCase())) {
      return false;
    }
    if (ipFilter) {
      if (!activity.ipAddress || !activity.ipAddress.toLowerCase().includes(ipFilter.toLowerCase())) {
        return false;
      }
    }
    if (browserFilter !== 'all' && !activity.browser.toLowerCase().includes(browserFilter.toLowerCase())) {
      return false;
    }
    if (flaggedOnly && !activity.isFlagged) {
      return false;
    }
    if (classificationFilter !== 'all' && classification.key !== classificationFilter) {
      return false;
    }
    if (dateFrom) {
      const activityDate = new Date(activity.detectedAt);
      const fromDate = new Date(dateFrom);
      if (activityDate < fromDate) {
        return false;
      }
    }
    if (dateTo) {
      const activityDate = new Date(activity.detectedAt);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (activityDate > toDate) {
        return false;
      }
    }
    return true;
  });

  const uniqueBrowsers = Array.from(new Set([
    'Chrome',
    'Firefox',
    'Safari',
    'Edge',
    'Opera',
    ...activities.map(a => a.browser)
  ])).filter(Boolean).sort();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('networkActivity.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('networkActivity.description')}
        </p>
      </div>

      {focusedThreatId && (
        <Alert className="border-amber-500/40 bg-amber-500/10">
          <AlertTitle>{tx('networkActivity.focusedThreatTitle', 'Focused threat')}</AlertTitle>
          <AlertDescription className="font-mono text-xs">
            {focusedThreatId}
          </AlertDescription>
        </Alert>
      )}

      {focusedAlertId && (
        <Alert className="border-sky-500/40 bg-sky-500/10">
          <AlertTitle>{tx('networkActivity.focusedAlertTitle', 'Focused alert')}</AlertTitle>
          <AlertDescription className="font-mono text-xs">
            {focusedAlertId}
          </AlertDescription>
        </Alert>
      )}

      {(navigationContext.from === 'alerts' || navigationContext.from === 'map' || navigationContext.from === 'threats') && (
        <Alert className="border-sky-500/40 bg-sky-500/10">
          <AlertTitle>{tx('networkActivity.contextTitle', 'Focused flow context')}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {navigationContext.returnHref && (
              <Button size="sm" variant="link" className="h-auto px-1" onClick={() => setLocation(navigationContext.returnHref)}>
                {navigationContext.returnLabel}
              </Button>
            )}
            <Button size="sm" variant="link" className="h-auto px-1" onClick={() => setLocation(navigationContext.alertsHref)}>
              {tx('networkActivity.openAlerts', 'Open Alerts')}
            </Button>
            <Button size="sm" variant="link" className="h-auto px-1" onClick={() => setLocation(navigationContext.threatsHref)}>
              {tx('networkActivity.openThreatLog', 'Open Threat Log')}
            </Button>
            <Button size="sm" variant="link" className="h-auto px-1" onClick={() => setLocation(navigationContext.mapHref)}>
              {tx('networkActivity.openThreatMap', 'Open Threat Map')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground mr-1">{tx('common.view', 'View')}:</span>
            <Button size="sm" variant={viewMode === 'all' ? 'default' : 'outline'} onClick={() => setViewMode('all')}>
              {tx('common.overview', 'Overview')}
            </Button>
            <Button size="sm" variant={viewMode === 'flow' ? 'default' : 'outline'} onClick={() => setViewMode('flow')}>
              {tx('networkActivity.networkFlow', 'Network Flow')}
            </Button>
            <Button size="sm" variant={viewMode === 'history' ? 'default' : 'outline'} onClick={() => setViewMode('history')}>
              {tx('networkActivity.browsingHistory', 'Browsing History')}
            </Button>
          </div>
        </CardContent>
      </Card>

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

      {/* Bot Traffic Widget */}
      {viewMode !== 'history' && (
        <div className="h-[300px]">
          <BotTrafficChart />
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
          <div className="mb-4 rounded-xl border bg-muted/30 p-3" data-testid="traffic-class-quick-filters">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {tx('networkActivity.trafficClass', 'Traffic class')}
            </div>
            <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={classificationFilter === 'all' ? 'default' : 'outline'}
              className="rounded-full"
              onClick={() => setClassificationFilter('all')}
            >
              {tx('networkActivity.allClasses', 'All classes')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={classificationFilter === 'local-safe' ? 'default' : 'outline'}
              className={`rounded-full ${classificationFilter === 'local-safe' ? 'bg-emerald-600 hover:bg-emerald-600/90 text-white border-emerald-600' : 'border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10'}`}
              onClick={() => setClassificationFilter('local-safe')}
            >
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
              {tx('networkActivity.localSafe', 'Local-safe')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={classificationFilter === 'public-external' ? 'default' : 'outline'}
              className={`rounded-full ${classificationFilter === 'public-external' ? 'bg-amber-600 hover:bg-amber-600/90 text-white border-amber-600' : 'border-amber-500/40 text-amber-700 hover:bg-amber-500/10'}`}
              onClick={() => setClassificationFilter('public-external')}
            >
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
              {tx('networkActivity.publicExternal', 'Public-external')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={classificationFilter === 'needs-review' ? 'default' : 'outline'}
              className={`rounded-full ${classificationFilter === 'needs-review' ? 'bg-destructive hover:bg-destructive/90 text-white border-destructive' : 'border-destructive/40 text-destructive hover:bg-destructive/10'}`}
              onClick={() => setClassificationFilter('needs-review')}
            >
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
              {tx('networkActivity.needsReview', 'Needs review')}
            </Button>
            </div>
          </div>

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
              <label className="text-sm font-medium">{tx('networkActivity.trafficClass', 'Traffic class')}</label>
              <Select value={classificationFilter} onValueChange={(v) => setClassificationFilter(v as any)}>
                <SelectTrigger data-testid="select-classification-filter">
                  <SelectValue placeholder={tx('networkActivity.allClasses', 'All classes')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tx('networkActivity.allClasses', 'All classes')}</SelectItem>
                  <SelectItem value="local-safe">{tx('networkActivity.localSafe', 'Local-safe')}</SelectItem>
                  <SelectItem value="public-external">{tx('networkActivity.publicExternal', 'Public-external')}</SelectItem>
                  <SelectItem value="needs-review">{tx('networkActivity.needsReview', 'Needs review')}</SelectItem>
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
                  setClassificationFilter('all');
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

      {viewMode !== 'history' && (
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
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{flowSummary.events} {tx('networkActivity.eventsLabel', 'events')}</Badge>
            <Badge variant="outline">{flowSummary.protocolKinds} {tx('networkActivity.protocolTypesLabel', 'protocol types')}</Badge>
            <Badge variant="outline">{flowSummary.severities} {tx('networkActivity.severitiesLabel', 'severities')}</Badge>
            <Badge variant={suspiciousSummary.suspicious > 0 ? 'destructive' : 'outline'}>
              {suspiciousSummary.suspicious} {tx('networkActivity.suspiciousLabel', 'suspicious')}
            </Badge>
            {flowSummary.latestTs && (
              <Badge variant="outline">{tx('networkActivity.latestLabel', 'Latest')}: {format(new Date(flowSummary.latestTs), 'HH:mm:ss')}</Badge>
            )}
          </div>

          {/* Flow Filters */}
          <div className="grid gap-4 md:grid-cols-4 mb-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('threats.severity') || 'Severity'}</label>
              <Select value={flowSeverity} onValueChange={setFlowSeverity}>
                <SelectTrigger>
                  <SelectValue placeholder={tx('networkActivity.allOption', 'All')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tx('networkActivity.allOption', 'All')}</SelectItem>
                  <SelectItem value="critical">{tx('networkActivity.severityCritical', 'Critical')}</SelectItem>
                  <SelectItem value="high">{tx('networkActivity.severityHigh', 'High')}</SelectItem>
                  <SelectItem value="medium">{tx('networkActivity.severityMedium', 'Medium')}</SelectItem>
                  <SelectItem value="low">{tx('networkActivity.severityLow', 'Low')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('networkActivity.protocol') || 'Protocol'}</label>
              <Select value={flowProtocol} onValueChange={setFlowProtocol}>
                <SelectTrigger>
                  <SelectValue placeholder={tx('networkActivity.allOption', 'All')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tx('networkActivity.allOption', 'All')}</SelectItem>
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
                  <SelectItem value="15m">{tx('networkActivity.last15Minutes', 'Last 15 minutes')}</SelectItem>
                  <SelectItem value="1h">{tx('networkActivity.lastHour', 'Last hour')}</SelectItem>
                  <SelectItem value="24h">{tx('networkActivity.last24Hours', 'Last 24 hours')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{tx('networkActivity.sourceIpFilter', 'Source IP')}</label>
              <Input
                placeholder={tx('networkActivity.sourceIpFilterPlaceholder', 'Filter source IP (e.g. 8.8.8.8)')}
                value={flowSourceFilter}
                onChange={(e) => setFlowSourceFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="mb-5 flex items-center gap-2">
            <Checkbox
              id="flow-suspicious-only"
              checked={flowSuspiciousOnly}
              onCheckedChange={(v) => setFlowSuspiciousOnly(Boolean(v))}
            />
            <label htmlFor="flow-suspicious-only" className="text-sm font-medium">
              {tx('networkActivity.suspiciousOnly', 'Show suspicious only')}
            </label>
            <Badge variant="outline" className="ml-1">
              {visibleFlow.length}
            </Badge>
            <div className="ml-2 inline-flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant={flowListMode === 'events' ? 'default' : 'outline'}
                onClick={() => setFlowListMode('events')}
              >
                {tx('networkActivity.eventsView', 'Events')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={flowListMode === 'sources' ? 'default' : 'outline'}
                onClick={() => setFlowListMode('sources')}
              >
                {tx('networkActivity.sourcesView', 'Sources')}
              </Button>
            </div>
          </div>

          {(suspiciousSummary.repeated > 0 || suspiciousSummary.unusualProto > 0 || suspiciousSummary.externalHigh > 0) && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {suspiciousSummary.repeated > 0 && (
                <Badge variant="destructive">{suspiciousSummary.repeated} {tx('networkActivity.sourceSpikesLabel', 'source spikes')}</Badge>
              )}
              {suspiciousSummary.externalHigh > 0 && (
                <Badge variant="destructive">{suspiciousSummary.externalHigh} {tx('networkActivity.externalHighRiskLabel', 'external high risk')}</Badge>
              )}
              {suspiciousSummary.unusualProto > 0 && (
                <Badge variant="outline">{suspiciousSummary.unusualProto} {tx('networkActivity.unusualProtocolLabel', 'unusual protocol')}</Badge>
              )}
            </div>
          )}

          {/* Analytics Row */}
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            {/* Severity Distribution */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="text-sm">{t('networkActivity.severityDistribution') || 'Severity distribution'}</CardTitle>
              </CardHeader>
              <CardContent>
                {severityData.length === 0 ? (
                  <div className="text-sm text-muted-foreground">{tx('common.noData', 'No data')}</div>
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
                  <div className="text-sm text-muted-foreground">{tx('common.noData', 'No data')}</div>
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
                  <div className="text-sm text-muted-foreground">{tx('common.noData', 'No data')}</div>
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
                <div className="text-sm text-muted-foreground">{tx('common.noData', 'No data')}</div>
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
          ) : filteredFlow.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{tx('networkActivity.noFlowMatches', 'No matching flow events')}</AlertTitle>
              <AlertDescription>
                {tx('networkActivity.noFlowMatchesDescription', 'Try widening time window or clearing flow filters.')}
              </AlertDescription>
            </Alert>
          ) : visibleFlow.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{tx('networkActivity.noSuspiciousFlow', 'No suspicious flow events')}</AlertTitle>
              <AlertDescription>
                {tx('networkActivity.noSuspiciousFlowDescription', 'No events match the suspicious criteria in the current window.')}
              </AlertDescription>
            </Alert>
          ) : flowListMode === 'sources' ? (
            <div className="space-y-3 max-h-[400px] overflow-y-auto" data-testid="network-flow-source-groups">
              {groupedFlowSources.map((group) => (
                <div
                  key={group.sourceIP}
                  ref={focusSourceIp && group.sourceIP.toLowerCase() === focusSourceIp ? focusedSourceCardRef : undefined}
                  className={`rounded-lg border p-3 hover-elevate ${focusSourceIp && group.sourceIP.toLowerCase() === focusSourceIp ? 'ring-2 ring-amber-500/60 border-amber-500/60' : ''}`}
                >
                  <div className="mb-2 flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs">{group.sourceIP}</span>
                    <Badge variant="secondary" className="text-xs">{group.count} {tx('networkActivity.eventsLabel', 'events')}</Badge>
                    {group.suspiciousCount > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {group.suspiciousCount} {tx('networkActivity.suspiciousLabel', 'suspicious')}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">{tx('networkActivity.riskLabel', 'Risk')} {group.maxRisk}</Badge>
                  </div>

                  <div className="grid gap-2 md:grid-cols-3 text-xs text-muted-foreground">
                    <div>
                      {tx('networkActivity.firstSeenLabel', 'First seen')}: {format(new Date(group.firstSeenTs), 'HH:mm:ss')}
                    </div>
                    <div>
                      {tx('networkActivity.lastSeenLabel', 'Last seen')}: {format(new Date(group.lastSeenTs), 'HH:mm:ss')}
                    </div>
                    <div>
                      {tx('networkActivity.protocolMixLabel', 'Protocol mix')}: {group.topProtocols.join(', ') || 'N/A'}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleFilterBySource(group.sourceIP)}>
                      {tx('networkActivity.actionFilterSource', 'Filter source')}
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleCopySourceIp(group.sourceIP)}>
                      {tx('networkActivity.actionCopyIp', 'Copy IP')}
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleOpenThreatMap(group.sourceIP)}>
                      {tx('networkActivity.actionOpenThreatMap', 'Open Threat Map')}
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleOpenThreatLog(group.sourceIP)}>
                      {tx('networkActivity.actionOpenThreatLog', 'Open Threat Log')}
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleOpenAlerts(group.sourceIP)}>
                      {tx('networkActivity.actionOpenAlerts', 'Open Alerts')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto" data-testid="network-flow-list">
              {visibleFlow.map(({ event: ev, repeatedSource, unusualProtocol, externalHighSeverity, riskScore }) => (
                <div
                  key={ev.id}
                  ref={focusSourceIp && String(ev.sourceIP || '').toLowerCase() === focusSourceIp ? focusedFlowRowRef : undefined}
                  className={`flex items-start gap-3 p-3 rounded-lg border hover-elevate ${focusSourceIp && String(ev.sourceIP || '').toLowerCase() === focusSourceIp ? 'ring-2 ring-amber-500/60 border-amber-500/60' : ''}`}
                >
                  <Zap className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs">{ev.sourceIP} ➜ {ev.destinationIP}</span>
                      <Badge variant="secondary" className="text-xs">{ev.protocol || 'n/a'}</Badge>
                      <Badge variant={ev.severity === 'critical' ? 'destructive' : ev.severity === 'high' ? 'default' : 'outline'} className="text-xs">
                        {ev.severity}
                      </Badge>
                      {repeatedSource && <Badge variant="destructive" className="text-xs">{tx('networkActivity.spikeBadge', 'Spike')}</Badge>}
                      {externalHighSeverity && <Badge variant="destructive" className="text-xs">{tx('networkActivity.externalRiskBadge', 'External risk')}</Badge>}
                      {unusualProtocol && <Badge variant="outline" className="text-xs">{tx('networkActivity.unusualProtocolBadge', 'Unusual protocol')}</Badge>}
                      <Badge variant="outline" className="text-xs">{tx('networkActivity.riskLabel', 'Risk')} {riskScore}</Badge>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {format(new Date(ev.timestamp), 'HH:mm:ss')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">{ev.eventType} {ev.action ? `(${ev.action})` : ''}</p>
                    {ev.message && (
                      <p className="text-xs text-muted-foreground truncate" title={ev.message}>{ev.message}</p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleFilterBySource(ev.sourceIP)}>
                        {tx('networkActivity.actionFilterSource', 'Filter source')}
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleCopySourceIp(ev.sourceIP)}>
                        {tx('networkActivity.actionCopyIp', 'Copy IP')}
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleOpenThreatMap(ev.sourceIP)}>
                        {tx('networkActivity.actionOpenThreatMap', 'Open Threat Map')}
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleOpenThreatLog(ev.sourceIP)}>
                        {tx('networkActivity.actionOpenThreatLog', 'Open Threat Log')}
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleOpenAlerts(ev.sourceIP)}>
                        {tx('networkActivity.actionOpenAlerts', 'Open Alerts')}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {viewMode !== 'flow' && (
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
                const BrowserIcon = getBrowserIcon(activity.browser);
                const provider = getProviderInfo(activity.domain);
                const classification = getEntryClassification(activity);
                const isHttp = !!activity.fullUrl && (activity.fullUrl.startsWith('http://') || activity.fullUrl.startsWith('https://'));

                return (
                  <div
                    key={activity.id}
                    className={
                      `flex items-start gap-3 p-4 rounded-lg border hover-elevate transition-colors ` +
                      (activity.isFlagged ? 'border-destructive/40 bg-destructive/5 ring-1 ring-destructive/20' : '')
                    }
                    data-testid={`activity-${activity.id}`}
                  >
                    <BrowserIcon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                         {provider && (
                           <Badge variant="outline" className={`${provider.color} ${provider.bg} border-transparent font-medium`}>
                              {provider.name}
                           </Badge>
                        )}
                        <p className={`font-medium font-mono text-sm truncate ${activity.isFlagged ? 'text-destructive' : ''}`} title={activity.domain}>
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
                        {!provider && (
                          <Badge variant="secondary" className="text-xs text-muted-foreground/70 font-normal">
                            {activity.browser}
                          </Badge>
                        )}

                        <Badge variant="outline" className={`text-[10px] h-5 px-1.5 font-medium ${classification.className}`}>
                          {classification.label}
                        </Badge>
                        
                        <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                          {format(new Date(activity.detectedAt), 'PPp')}
                        </span>
                        
                        {!activity.isFlagged && (
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                  disabled={flagDomainMut.isPending && pendingFlagDomain === activity.domain}
                                  onClick={() => flagDomainMut.mutate(activity.domain)}
                                >
                                  <Filter className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {t('networkActivity.flagDomainTooltip') || 'Mark this domain as flagged to highlight it and include it in flagged stats.'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      
                      {activity.fullUrl && activity.fullUrl !== activity.domain && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mb-1 max-w-full">
                           {isHttp ? (
                             <a 
                               href={activity.fullUrl} 
                               target="_blank" 
                               rel="noopener noreferrer" 
                               className="text-primary hover:underline hover:text-primary/80 truncate block"
                             >
                               {activity.fullUrl}
                             </a>
                           ) : (
                             <span className="truncate block">{activity.fullUrl}</span>
                           )}
                           {isHttp && <Globe className="h-3 w-3 opacity-50 flex-shrink-0" />}
                        </div>
                      )}
                      
                      {activity.ipAddress && (
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-muted-foreground bg-muted/30 font-mono">
                            IP: {activity.ipAddress}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
