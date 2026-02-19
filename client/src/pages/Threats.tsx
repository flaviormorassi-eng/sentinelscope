import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, Search, Filter, Unlock, History, ExternalLink, Monitor, Mail, Usb, Globe, Network, XCircle } from 'lucide-react';
import { Threat, User } from '@shared/schema';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useThreatFilters } from '@/hooks/useThreatFilters';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Link, useSearch } from 'wouter';

interface ThreatDecision {
  id: number;
  threatId: string;
  adminId: string;
  decision: string;
  reason: string | null;
  timestamp: string;
}

type ThreatListResponse = {
  data: Threat[];
  total: number;
  limit: number;
  offset: number;
  mode?: 'demo' | 'real';
  targetFound?: boolean;
  targetIndex?: number;
  targetPage?: number;
};

export default function Threats() {
  const { t } = useTranslation();
  const searchString = useSearch();
  const { user } = useAuth();
  const { toast } = useToast();
  const selectedThreatId = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return (params.get('threatId') || '').trim();
  }, [searchString]);
  const selectedAlertId = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return (params.get('alertId') || '').trim();
  }, [searchString]);
  // Centralized filters + persistence
  const {
    severityFilter,
    setSeverityFilter,
    typeFilter,
    setTypeFilter,
    typeFilterEffective,
    sourceInput,
    setSourceInput,
    sourceQuery,
    statusFilter,
    setStatusFilter,
    searchInput,
    setSearchInput,
    searchQuery,
    page,
    setPage,
    pageSize,
    setPageSize,
    clearFilters,
  } = useThreatFilters(user?.uid);
  const [historyThreatId, setHistoryThreatId] = useState<string | null>(null);
  const selectedThreatRowRef = useRef<HTMLTableRowElement | null>(null);

  // Value adapters: select expects 'all' when undefined in hook
  const typeValue = typeFilter ?? 'all';
  const sevValue = severityFilter ?? 'all';
  const statusValue = statusFilter ?? 'all';

  const { data: currentUser } = useQuery<User>({
    queryKey: [`/api/user/${user?.uid}`],
    enabled: !!user?.uid,
  });

  const { data: listResp, isLoading } = useQuery<ThreatListResponse>({
    queryKey: [
      'threats/list',
      page,
      pageSize,
      sevValue,
      statusValue,
      searchQuery,
      typeFilterEffective,
      sourceQuery,
      selectedThreatId,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', String(pageSize));
      params.set('offset', String((page - 1) * pageSize));
      if (severityFilter) params.set('sev', severityFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (searchQuery) params.set('q', searchQuery);
      if (typeFilterEffective) params.set('type', typeFilterEffective);
      if (sourceQuery) params.set('src', sourceQuery);
      if (selectedThreatId) params.set('threatId', selectedThreatId);
      const url = `/api/threats/list?${params.toString()}`;
      return apiRequest('GET', url) as Promise<ThreatListResponse>;
    },
    // Periodically refresh so new real-mode threats appear without reload
    refetchInterval: 15000,
    placeholderData: (prev) => prev as ThreatListResponse | undefined,
  });

  useEffect(() => {
    if (!selectedThreatId) return;
    if (isLoading) return;
    if (!listResp?.targetFound) return;
    if (!listResp?.targetPage) return;
    if (listResp.targetPage === page) return;
    setPage(listResp.targetPage);
  }, [selectedThreatId, isLoading, listResp?.targetFound, listResp?.targetPage, page, setPage]);

  const { data: decisionHistory = [], isLoading: historyLoading } = useQuery<ThreatDecision[]>({
    queryKey: [`/api/admin/threats/${historyThreatId}/history`],
    enabled: !!historyThreatId && !!currentUser?.isAdmin,
  });

  const unblockMutation = useMutation({
    mutationFn: async (threatId: string) => {
      return await apiRequest('POST', `/api/threats/${threatId}/decide`, {
        decision: 'unblock',
        reason: 'Unblocked from threat log view',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threats/list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/threats/pending'] });
      toast({
        title: t('admin.decisionRecorded'),
        description: t('threats.threatUnblocked'),
      });
    },
    onError: (err: any) => {
      toast({
        title: t('common.error'),
        description: err?.message || t('admin.threatDecisionError'),
        variant: 'destructive',
      });
    },
  });

  const blockMutation = useMutation({
    mutationFn: async (threatId: string) => {
      return await apiRequest('POST', `/api/threats/${threatId}/decide`, {
        decision: 'block',
        reason: 'Blocked from threat log view',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threats/list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/threats/pending'] });
      toast({
        title: t('admin.decisionRecorded'),
        description: 'Threat blocked.',
      });
    },
    onError: (err: any) => {
      toast({
        title: t('common.error'),
        description: err?.message || t('admin.threatDecisionError'),
        variant: 'destructive',
      });
    },
  });

  const allowMutation = useMutation({
    mutationFn: async (threatId: string) => {
      return await apiRequest('POST', `/api/threats/${threatId}/decide`, {
        decision: 'allow',
        reason: 'Marked as not a threat from threat log view',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threats/list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/threats/pending'] });
      toast({
        title: t('admin.decisionRecorded'),
        description: t('admin.threatAllowed', 'Marked as not a threat.'),
      });
    },
    onError: (err: any) => {
      toast({
        title: t('common.error'),
        description: err?.message || t('admin.threatDecisionError'),
        variant: 'destructive',
      });
    },
  });

  const threatsData: Threat[] = listResp?.data ?? ([] as Threat[]);
  // Runtime diagnostics
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.debug('[Threats] listResp', listResp);
  }
  const filteredThreats = threatsData.filter((threat: Threat) => {
    // When we send q to the server, skip local search matching to avoid double-filtering
    const matchesSearch = searchQuery
      ? true
      : (
        (threat.sourceIP || '').toLowerCase().includes(searchInput.toLowerCase()) ||
        (threat.description || '').toLowerCase().includes(searchInput.toLowerCase()) ||
        (threat.type || '').toLowerCase().includes(searchInput.toLowerCase()) ||
        (threat.deviceName && threat.deviceName.toLowerCase().includes(searchInput.toLowerCase())) ||
        (threat.sourceURL && threat.sourceURL.toLowerCase().includes(searchInput.toLowerCase())) ||
        (threat.threatVector && threat.threatVector.toLowerCase().includes(searchInput.toLowerCase()))
      );
    
    // Severity filter is already applied server-side when not 'all', but keep for safety
    const matchesSeverity = !severityFilter || threat.severity === severityFilter;
    const matchesStatus = !statusFilter || threat.status === statusFilter;

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'blocked': return 'destructive';
      case 'pending_review': return 'secondary';
      case 'allowed': return 'default';
      case 'unblocked': return 'default';
      default: return 'outline';
    }
  };

  const getThreatVectorIcon = (vector: string | null) => {
    if (!vector) return null;
    switch (vector) {
      case 'email': return <Mail className="h-3 w-3" />;
      case 'web': return <Globe className="h-3 w-3" />;
      case 'network': return <Network className="h-3 w-3" />;
      case 'usb': return <Usb className="h-3 w-3" />;
      case 'download': return <Download className="h-3 w-3" />;
      default: return <Monitor className="h-3 w-3" />;
    }
  };

  const safeFormatTs = (ts: any) => {
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '-';
      return format(d, 'yyyy-MM-dd HH:mm:ss');
    } catch {
      return '-';
    }
  };

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'Severity', 'Type', 'Source IP', 'Target IP', 'Device', 'Vector', 'Source URL', 'Status', 'Description'],
      ...filteredThreats.map(t => [
        format(new Date(t.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        t.severity,
        t.type,
        t.sourceIP,
        t.targetIP,
        t.deviceName || '-',
        t.threatVector || '-',
        t.sourceURL || '-',
        t.status,
        t.description
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threats-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getThreatFlowHref = (threat: Threat) => {
    const params = new URLSearchParams();
    params.set('from', 'threats');
    params.set('view', 'flow');
    if (threat.sourceIP && threat.sourceIP !== '-') {
      params.set('sourceIp', threat.sourceIP);
      params.set('focusSourceIp', threat.sourceIP);
    }
    params.set('threatId', threat.id);
    if (selectedAlertId) params.set('alertId', selectedAlertId);
    return `/network-activity?${params.toString()}`;
  };

  const getThreatMapHref = (threat: Threat) => {
    const params = new URLSearchParams();
    params.set('from', 'threats');
    if (threat.sourceIP && threat.sourceIP !== '-') {
      params.set('sourceIp', threat.sourceIP);
    }
    params.set('threatId', threat.id);
    if (selectedAlertId) params.set('alertId', selectedAlertId);
    return `/map?${params.toString()}`;
  };

  const getThreatAlertsHref = (threat: Threat) => {
    const params = new URLSearchParams();
    params.set('tab', 'alerts');
    params.set('from', 'threats');
    params.set('threatId', threat.id);
    if (selectedAlertId) params.set('alertId', selectedAlertId);
    if (threat.sourceIP && threat.sourceIP !== '-') {
      params.set('src', threat.sourceIP);
    }
    return `/security-center?${params.toString()}`;
  };

  const flowContext = useMemo(() => {
    const params = new URLSearchParams(searchString);
    const from = (params.get('from') || '').trim();
    const fromFlow = params.get('from') === 'flow';
    const fromMap = params.get('from') === 'map';
    const fromAlerts = params.get('from') === 'alerts';
    const src = (params.get('src') || '').trim();
    const threatId = (params.get('threatId') || '').trim();
    const alertId = (params.get('alertId') || '').trim();
    const returnView = (params.get('returnView') || 'flow').trim();
    const returnWindow = (params.get('returnWindow') || '').trim();
    const returnSuspicious = (params.get('returnSuspicious') || '').trim();
    const returnSourceIp = (params.get('returnSourceIp') || src).trim();

    const returnParams = new URLSearchParams();
    if (returnView) returnParams.set('view', returnView);
    if (returnWindow === '15m' || returnWindow === '1h' || returnWindow === '24h') returnParams.set('window', returnWindow);
    if (returnSuspicious === '1' || returnSuspicious === 'true') returnParams.set('suspicious', '1');
    if (returnSourceIp) returnParams.set('sourceIp', returnSourceIp);
    if (returnSourceIp) returnParams.set('focusSourceIp', returnSourceIp);
    if (threatId) returnParams.set('threatId', threatId);

    const qs = returnParams.toString();
    const returnHref = qs ? `/network-activity?${qs}` : '/network-activity';
    const mapParams = new URLSearchParams();
    mapParams.set('from', 'threats');
    if (src) mapParams.set('sourceIp', src);
    if (threatId) mapParams.set('threatId', threatId);
    if (alertId) mapParams.set('alertId', alertId);
    const mapQs = mapParams.toString();
    const returnMapHref = mapQs ? `/map?${mapQs}` : '/map';
    const alertsParams = new URLSearchParams();
    alertsParams.set('tab', 'alerts');
    alertsParams.set('from', 'threats');
    if (alertId) alertsParams.set('alertId', alertId);
    if (threatId) alertsParams.set('threatId', threatId);
    if (src) alertsParams.set('src', src);
    const returnAlertsHref = `/security-center?${alertsParams.toString()}`;

    return { from, fromFlow, fromMap, fromAlerts, src, threatId, alertId, returnHref, returnMapHref, returnAlertsHref };
  }, [searchString]);

  const displayThreats = useMemo(() => {
    if (!flowContext.threatId) return filteredThreats;

    const idx = filteredThreats.findIndex((th) => th.id === flowContext.threatId);
    if (idx < 0) return filteredThreats;

    const selected = filteredThreats[idx];
    const rest = [...filteredThreats.slice(0, idx), ...filteredThreats.slice(idx + 1)];
    const middle = Math.floor(rest.length / 2);
    return [...rest.slice(0, middle), selected, ...rest.slice(middle)];
  }, [filteredThreats, flowContext.threatId]);

  useEffect(() => {
    if (!flowContext.threatId) return;
    if (isLoading) return;
    if (!selectedThreatRowRef.current) return;

    try {
      selectedThreatRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
      // noop
    }
  }, [flowContext.threatId, isLoading, filteredThreats.length]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('threats.title')}</h1>
      </div>
      {flowContext.fromFlow && flowContext.src && (
        <Alert className="border-emerald-500/40 bg-emerald-500/10">
          <AlertTitle className="text-emerald-700 dark:text-emerald-400">
            {t('threats.flowContextTitle', 'Viewing flow-sourced threats')}
          </AlertTitle>
          <AlertDescription className="text-muted-foreground flex flex-wrap items-center gap-2">
            <span>
              {t('threats.flowContextDescription', 'Threat Log is pre-filtered by source IP')}: <strong className="font-mono">{flowContext.src}</strong>
            </span>
            <Link href={flowContext.returnHref}>
              <span className="underline text-emerald-700 dark:text-emerald-400 cursor-pointer">
                {t('threats.returnToFlow', 'Return to Flow')}
              </span>
            </Link>
            <Link href={flowContext.returnMapHref}>
              <span className="underline text-emerald-700 dark:text-emerald-400 cursor-pointer">
                {t('threats.openThreatMap', 'Open Threat Map')}
              </span>
            </Link>
            {flowContext.threatId && (
              <Link href={`/security-center?tab=alerts&from=threats&threatId=${encodeURIComponent(flowContext.threatId)}${flowContext.src ? `&src=${encodeURIComponent(flowContext.src)}` : ''}${flowContext.alertId ? `&alertId=${encodeURIComponent(flowContext.alertId)}` : ''}`}>
                <span className="underline text-emerald-700 dark:text-emerald-400 cursor-pointer">
                  {t('threats.openAlerts', 'Open Alerts')}
                </span>
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}
      {flowContext.fromMap && flowContext.src && (
        <Alert className="border-sky-500/40 bg-sky-500/10">
          <AlertTitle className="text-sky-700 dark:text-sky-400">
            {t('threats.mapContextTitle', 'Viewing map-sourced threats')}
          </AlertTitle>
          <AlertDescription className="text-muted-foreground flex flex-wrap items-center gap-2">
            <span>
              {t('threats.mapContextDescription', 'Threat Log is pre-filtered by mapped source IP')}: <strong className="font-mono">{flowContext.src}</strong>
            </span>
            <Link href={flowContext.returnMapHref}>
              <span className="underline text-sky-700 dark:text-sky-400 cursor-pointer">
                {t('threats.returnToMap', 'Return to Map')}
              </span>
            </Link>
            <Link href={flowContext.returnHref}>
              <span className="underline text-sky-700 dark:text-sky-400 cursor-pointer">
                {t('threats.openFlow', 'Open Flow')}
              </span>
            </Link>
            {flowContext.threatId && (
              <Link href={`/security-center?tab=alerts&from=threats&threatId=${encodeURIComponent(flowContext.threatId)}${flowContext.src ? `&src=${encodeURIComponent(flowContext.src)}` : ''}${flowContext.alertId ? `&alertId=${encodeURIComponent(flowContext.alertId)}` : ''}`}>
                <span className="underline text-sky-700 dark:text-sky-400 cursor-pointer">
                  {t('threats.openAlerts', 'Open Alerts')}
                </span>
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}
      {flowContext.fromAlerts && (flowContext.alertId || flowContext.threatId) && (
        <Alert className="border-violet-500/40 bg-violet-500/10">
          <AlertTitle className="text-violet-700 dark:text-violet-400">
            {t('threats.alertContextTitle', 'Viewing alert-sourced threat context')}
          </AlertTitle>
          <AlertDescription className="text-muted-foreground flex flex-wrap items-center gap-2">
            {flowContext.alertId && (
              <span>
                {t('threats.alertContextDescription', 'Context from alert')}: <strong className="font-mono">{flowContext.alertId}</strong>
              </span>
            )}
            <Link href={flowContext.returnAlertsHref}>
              <span className="underline text-violet-700 dark:text-violet-400 cursor-pointer">
                {t('threats.returnToAlerts', 'Return to Alerts')}
              </span>
            </Link>
            <Link href={flowContext.returnMapHref}>
              <span className="underline text-violet-700 dark:text-violet-400 cursor-pointer">
                {t('threats.openThreatMap', 'Open Threat Map')}
              </span>
            </Link>
            <Link href={flowContext.returnHref}>
              <span className="underline text-violet-700 dark:text-violet-400 cursor-pointer">
                {t('threats.openFlow', 'Open Flow')}
              </span>
            </Link>
          </AlertDescription>
        </Alert>
      )}
      {selectedThreatId && !isLoading && listResp?.targetFound === false && (
        <Alert className="border-amber-500/40 bg-amber-500/10">
          <AlertTitle>{t('threats.selectedThreatNotFoundTitle', 'Selected threat not found in current filters')}</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            {t('threats.selectedThreatNotFoundDescription', 'Try clearing filters to locate the selected threat.')} 
            <Button
              size="sm"
              variant="link"
              className="px-1 h-auto"
              onClick={() => {
                clearFilters();
              }}
            >
              {t('common.clearFilters', { defaultValue: 'Clear Filters' })}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {listResp?.mode === 'real' && (listResp?.total ?? 0) === 0 && (
        <Alert className="border-blue-500/40 bg-blue-500/10">
          <AlertTitle className="text-blue-600 dark:text-blue-400">Real monitoring enabled</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            No real-time threat events have been received yet. Create an event source and send events to see live data.
            {' '}<Link href="/event-sources"><span className="underline text-blue-600 dark:text-blue-400">Go to Event Sources</span></Link>
          </AlertDescription>
        </Alert>
      )}
      {/* Debug block removed as per user request
      {import.meta.env.DEV && (
        <div className="rounded border p-3 text-xs bg-muted/40">
          <strong>Debug:</strong> total={listResp?.total ?? 'n/a'} limit={listResp?.limit ?? 'n/a'} offset={listResp?.offset ?? 'n/a'} pageState={page} pageSize={pageSize} severityFilter={sevValue} statusFilter={statusValue} typeFilter={typeValue} src={sourceQuery || '(none)'} q={searchQuery || '(none)'}
          <div>dataCount(threatsData)={threatsData.length} filteredCount={filteredThreats.length}</div>
          {!isLoading && threatsData.length === 0 && <div>No data from /api/threats/list. If just seeded, hard refresh (Cmd+Shift+R).</div>}
          {(!isLoading && threatsData.length === 0 && listResp) && (
            <details className="mt-2">
              <summary>Raw response JSON</summary>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap">
{JSON.stringify(listResp, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
      */}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('threats.search')}
                value={searchInput}
                onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
                className="pl-9"
                data-testid="input-search-threats"
              />
            </div>
            <div className="flex gap-2">
              <Select value={typeValue} onValueChange={(v) => { setTypeFilter(v === 'all' ? undefined : v); setPage(1); }}>
                <SelectTrigger className="w-[160px]" data-testid="select-type-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={t('threats.type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="ddos">{t('threats.types.ddos')}</SelectItem>
                  <SelectItem value="phishing">{t('threats.types.phishing')}</SelectItem>
                  <SelectItem value="malware">{t('threats.types.malware')}</SelectItem>
                  <SelectItem value="ransomware">{t('threats.types.ransomware')}</SelectItem>
                  <SelectItem value="botnet">{t('threats.types.botnet')}</SelectItem>
                  <SelectItem value="brute_force">{t('threats.types.brute_force')}</SelectItem>
                  <SelectItem value="port_scan">{t('threats.types.port_scan')}</SelectItem>
                  <SelectItem value="malware_traffic">{t('threats.types.malware_traffic')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sevValue} onValueChange={(v) => { setSeverityFilter(v === 'all' ? undefined : (v as any)); setPage(1); }}>
                <SelectTrigger className="w-[150px]" data-testid="select-severity-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={t('threats.severity')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">{t('threats.severityLevels.critical')}</SelectItem>
                  <SelectItem value="high">{t('threats.severityLevels.high')}</SelectItem>
                  <SelectItem value="medium">{t('threats.severityLevels.medium')}</SelectItem>
                  <SelectItem value="low">{t('threats.severityLevels.low')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusValue} onValueChange={(v) => { setStatusFilter(v === 'all' ? undefined : v); setPage(1); }}>
                <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                  <SelectValue placeholder={t('threats.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="detected">{t('threats.statuses.detected')}</SelectItem>
                  <SelectItem value="pending_review">{t('threats.statuses.pending_review')}</SelectItem>
                  <SelectItem value="blocked">{t('threats.statuses.blocked')}</SelectItem>
                  <SelectItem value="allowed">{t('threats.statuses.allowed')}</SelectItem>
                  <SelectItem value="unblocked">{t('threats.statuses.unblocked')}</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative">
                <Input
                  placeholder="Source contains (IP/URL/device)"
                  value={sourceInput}
                  onChange={(e) => { setSourceInput(e.target.value); setPage(1); }}
                  className="w-[220px]"
                  data-testid="input-source-filter"
                />
              </div>

              <Button
                onClick={() => {
                  clearFilters();
                }}
                variant="ghost"
                data-testid="button-clear-filters"
              >
                {t('common.clearFilters', { defaultValue: 'Clear Filters' })}
              </Button>

              <Button onClick={handleExport} variant="outline" data-testid="button-export">
                <Download className="h-4 w-4 mr-2" />
                {t('threats.export')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">{t('threats.timestamp')}</TableHead>
                  <TableHead className="w-[100px]">{t('threats.severity')}</TableHead>
                  <TableHead>{t('threats.type')}</TableHead>
                  <TableHead className="w-[140px]">{t('threats.source')}</TableHead>
                  <TableHead className="w-[120px]">{t('threats.device')}</TableHead>
                  <TableHead className="w-[80px]">{t('threats.vector')}</TableHead>
                  <TableHead className="w-[200px]">{t('threats.sourceURL')}</TableHead>
                  <TableHead className="w-[120px]">{t('threats.status')}</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right w-[160px]">{t('admin.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={currentUser?.isAdmin ? 11 : 10} className="text-center py-8 text-muted-foreground">
                      {t('common.loading')}
                    </TableCell>
                  </TableRow>
                ) : displayThreats.length > 0 ? (
                  displayThreats.map((threat) => (
                    <TableRow
                      key={threat.id}
                      ref={flowContext.threatId && threat.id === flowContext.threatId ? selectedThreatRowRef : undefined}
                      className={flowContext.threatId && threat.id === flowContext.threatId ? 'bg-amber-500/10 ring-1 ring-amber-500/40' : ''}
                      data-testid={`row-threat-${threat.id}`}
                    >
                      <TableCell className="font-mono text-xs">
                        {safeFormatTs(threat.timestamp)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getSeverityBadgeVariant(threat.severity)}>
                          {t(`threats.severityLevels.${threat.severity}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>{t(`threats.types.${threat.type}`)}</TableCell>
                      <TableCell className="font-mono text-xs">{threat.sourceIP}</TableCell>
                      <TableCell className="font-mono text-xs">{threat.deviceName || '-'}</TableCell>
                      <TableCell>
                        {threat.threatVector ? (
                          <div className="flex items-center gap-1" title={threat.threatVector}>
                            {getThreatVectorIcon(threat.threatVector)}
                            <span className="text-xs capitalize">{threat.threatVector}</span>
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {threat.sourceURL ? (
                          <a 
                            href={threat.sourceURL} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline text-xs"
                            data-testid={`link-source-url-${threat.id}`}
                          >
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{threat.sourceURL}</span>
                          </a>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(threat.status)}>
                          {t(`threats.statuses.${threat.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{threat.description}</TableCell>
                      
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Link href={getThreatFlowHref(threat)}>
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={`button-open-flow-${threat.id}`}
                            >
                              {t('threats.openFlow', 'Open Flow')}
                            </Button>
                          </Link>
                          <Link href={getThreatMapHref(threat)}>
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={`button-open-map-${threat.id}`}
                            >
                              {t('threats.openThreatMap', 'Open Threat Map')}
                            </Button>
                          </Link>
                          <Link href={getThreatAlertsHref(threat)}>
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={`button-open-alerts-${threat.id}`}
                            >
                              {t('threats.openAlerts', 'Open Alerts')}
                            </Button>
                          </Link>
                          {currentUser?.isAdmin && threat.status !== 'detected' && threat.status !== 'pending_review' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setHistoryThreatId(threat.id)}
                              data-testid={`button-history-${threat.id}`}
                            >
                              <History className="h-3 w-3 mr-1" />
                              {t('admin.history')}
                            </Button>
                          )}
                          {threat.status === 'blocked' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => unblockMutation.mutate(threat.id)}
                              disabled={unblockMutation.isPending}
                              data-testid={`button-unblock-${threat.id}`}
                            >
                              <Unlock className="h-3 w-3 mr-1" />
                              {t('admin.unblockThreat')}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => blockMutation.mutate(threat.id)}
                              disabled={blockMutation.isPending}
                              data-testid={`button-block-${threat.id}`}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              {t('admin.blockThreat')}
                            </Button>
                          )}
                          {threat.status !== 'allowed' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => allowMutation.mutate(threat.id)}
                              disabled={allowMutation.isPending}
                              data-testid={`button-allow-${threat.id}`}
                            >
                              {t('admin.markNotThreat', 'Not a threat')}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      {t('threats.noThreats')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {/** Pagination controls */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {(() => {
                const total = listResp?.total ?? 0;
                return total >= 0 ? (
                <span>
                  {t('common.showing')} {threatsData.length} {t('common.of')} {total} {t('threats.title').toLowerCase()}
                </span>
                ) : null;
              })()}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1 || isLoading}
              >
                {t('common.previous')}
              </Button>
              <span className="text-sm">
                {(() => {
                  const total = listResp?.total ?? 0;
                  const limit = listResp?.limit ?? pageSize;
                  return (
                    <>
                      {t('common.page')} {page} {t('common.of')} {Math.max(1, Math.ceil(total / limit))}
                    </>
                  );
                })()}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const total = listResp?.total ?? 0;
                  const limit = listResp?.limit ?? pageSize;
                  const maxPage = Math.max(1, Math.ceil(total / limit));
                  setPage(Math.min(maxPage, page + 1));
                }}
                disabled={(() => {
                  const total = listResp?.total ?? 0;
                  const limit = listResp?.limit ?? pageSize;
                  const offset = listResp?.offset ?? (page - 1) * pageSize;
                  return isLoading || (offset + limit) >= total;
                })()}
              >
                {t('common.next')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!historyThreatId} onOpenChange={(open) => !open && setHistoryThreatId(null)}>
        <DialogContent data-testid="dialog-threat-history">
          <DialogHeader>
            <DialogTitle>{t('admin.decisionHistory')}</DialogTitle>
            <DialogDescription>
              {t('admin.decisionHistoryDescription')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {historyLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : decisionHistory.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">{t('admin.timestamp')}</TableHead>
                      <TableHead className="w-[120px]">{t('admin.decision')}</TableHead>
                      <TableHead className="w-[120px]">{t('admin.admin')}</TableHead>
                      <TableHead>{t('admin.reason')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {decisionHistory.map((decision) => (
                      <TableRow key={decision.id} data-testid={`history-row-${decision.id}`}>
                        <TableCell className="font-mono text-xs">
                          {format(new Date(decision.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={decision.decision === 'block' ? 'destructive' : 'default'}>
                            {decision.decision}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{decision.adminId.slice(0, 8)}...</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {decision.reason || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">
                {t('admin.noDecisionHistory')}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
