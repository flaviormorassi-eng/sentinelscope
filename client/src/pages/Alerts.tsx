import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { getSeverityConfig, normalizeSeverity, type SeverityKey } from '../lib/severity';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { AlertTriangle, Bell, CheckCircle, CircleDot, RefreshCw, XCircle } from 'lucide-react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useLocation, useSearch } from 'wouter';

interface AlertItem {
  id: string;
  userId: string;
  threatId: string | null;
  timestamp: string;
  title: string;
  message: string;
  severity: string;
  read: boolean;
}

type AlertListResponse = {
  data: AlertItem[];
  total: number;
  limit: number;
  offset: number;
  unreadTotal?: number;
  targetAlertId?: string;
  targetFound?: boolean;
  targetIndex?: number;
  targetPage?: number;
};

// Map severity to badge styles
const severityConfig = {
  critical: { variant: 'destructive', icon: <XCircle className="h-4 w-4" />, label: 'critical' },
  high: { variant: 'destructive', icon: <AlertTriangle className="h-4 w-4" />, label: 'high' },
  medium: { variant: 'secondary', icon: <CircleDot className="h-4 w-4" />, label: 'medium' },
  low: { variant: 'outline', icon: <CheckCircle className="h-4 w-4" />, label: 'low' },
} as const satisfies Record<string, { variant: BadgeProps['variant']; icon: React.ReactNode; label: string }>;

export default function Alerts() {
  const { t } = useTranslation();
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const selectedAlertRowRef = useRef<HTMLTableRowElement | null>(null);

  const selectedAlertId = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return (params.get('alertId') || '').trim();
  }, [searchString]);

  const selectedThreatId = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return (params.get('threatId') || '').trim();
  }, [searchString]);

  const alertContext = useMemo(() => {
    const params = new URLSearchParams(searchString);
    const from = (params.get('from') || '').trim();
    const sourceIp = (params.get('src') || params.get('sourceIp') || '').trim();
    const threatId = (params.get('threatId') || '').trim();

    const mapParams = new URLSearchParams();
    if (sourceIp) mapParams.set('sourceIp', sourceIp);
    if (threatId) mapParams.set('threatId', threatId);
    const mapHref = mapParams.toString() ? `/map?${mapParams.toString()}` : '/map';

    const flowParams = new URLSearchParams();
    flowParams.set('view', 'flow');
    if (sourceIp) {
      flowParams.set('sourceIp', sourceIp);
      flowParams.set('focusSourceIp', sourceIp);
    }
    if (threatId) flowParams.set('threatId', threatId);
    const flowHref = `/network-activity?${flowParams.toString()}`;

    const threatParams = new URLSearchParams();
    threatParams.set('tab', 'threats');
    if (sourceIp) threatParams.set('src', sourceIp);
    if (threatId) threatParams.set('threatId', threatId);
    const threatHref = `/security-center?${threatParams.toString()}`;

    const returnHref = from === 'map' ? mapHref : from === 'threats' ? threatHref : from === 'flow' ? flowHref : '';
    const returnLabel = from === 'map'
      ? t('alerts.returnToThreatMap', 'Return to Threat Map')
      : from === 'threats'
        ? t('alerts.returnToThreatLog', 'Return to Threat Log')
        : from === 'flow'
          ? t('alerts.returnToFlow', 'Return to Flow')
          : '';

    return { from, sourceIp, threatId, mapHref, flowHref, threatHref, returnHref, returnLabel };
  }, [searchString, t]);

  const { data: listResp, isLoading, refetch } = useQuery<AlertListResponse>({
    queryKey: ['/api/alerts/list', page, pageSize, severityFilter, showUnreadOnly, search, selectedAlertId, selectedThreatId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', String(pageSize));
      params.set('offset', String((page - 1) * pageSize));
      if (severityFilter && severityFilter !== 'all') params.set('severity', severityFilter);
      if (showUnreadOnly) params.set('unread', '1');
      if (search.trim()) params.set('q', search.trim());
      if (selectedThreatId) params.set('threatId', selectedThreatId);
      if (selectedAlertId) params.set('alertId', selectedAlertId);
      return fetch(`/api/alerts/list?${params.toString()}`).then(r => r.json()) as Promise<AlertListResponse>;
    },
    refetchInterval: 30000, // auto refresh every 30s
    placeholderData: (prev) => prev as AlertListResponse | undefined,
  });

  const alerts = listResp?.data ?? [];

  useEffect(() => {
    if (!listResp?.targetFound) return;
    if (!listResp?.targetPage) return;
    if (listResp.targetPage === page) return;
    setPage(listResp.targetPage);
  }, [listResp?.targetFound, listResp?.targetPage, page]);

  // Unread count for badge (already used in sidebar but keep local)
  const unreadCount = useMemo(() => listResp?.unreadTotal ?? alerts.filter(a => !a.read).length, [alerts, listResp?.unreadTotal]);

  // Filtered alerts memo
  const filtered = alerts;

  const resolvedAlertId = useMemo(() => listResp?.targetAlertId || selectedAlertId || '', [listResp?.targetAlertId, selectedAlertId]);

  const displayAlerts = useMemo(() => {
    if (!resolvedAlertId) return filtered;
    const idx = filtered.findIndex(a => a.id === resolvedAlertId);
    if (idx < 0) return filtered;
    const selected = filtered[idx];
    const rest = [...filtered.slice(0, idx), ...filtered.slice(idx + 1)];
    const middle = Math.floor(rest.length / 2);
    return [...rest.slice(0, middle), selected, ...rest.slice(middle)];
  }, [filtered, resolvedAlertId]);

  const selectedAlertFound = useMemo(() => {
    if (!resolvedAlertId && !selectedThreatId) return undefined;
    if (typeof listResp?.targetFound === 'boolean') return listResp.targetFound;
    if (resolvedAlertId) return filtered.some(a => a.id === resolvedAlertId);
    return false;
  }, [filtered, resolvedAlertId, selectedThreatId, listResp?.targetFound]);

  useEffect(() => {
    if (!resolvedAlertId && !selectedThreatId) return;
    if (!selectedAlertFound) return;
    if (!selectedAlertRowRef.current) return;
    try {
      selectedAlertRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
      // noop
    }
  }, [resolvedAlertId, selectedThreatId, selectedAlertFound, displayAlerts.length, page]);

  // Mark as read mutation
  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/alerts/${id}/read`, { method: 'POST' });
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['/api/alerts'] });
      const prev = queryClient.getQueryData<AlertItem[]>(['/api/alerts']);
      if (prev) {
        queryClient.setQueryData<AlertItem[]>(['/api/alerts'], prev.map(a => a.id === id ? { ...a, read: true } : a));
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['/api/alerts'], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
    }
  });

  // Bulk clear mutation
  const clearAll = useMutation({
    mutationFn: async () => {
      await fetch('/api/alerts/clear-all', { method: 'DELETE' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/alerts'] })
  });

  const openAlertThreatLog = (alert: AlertItem) => {
    if (!alert.threatId) return;
    const src = alertContext.sourceIp ? `&src=${encodeURIComponent(alertContext.sourceIp)}` : '';
    setLocation(`/security-center?tab=threats&from=alerts&threatId=${encodeURIComponent(alert.threatId)}&alertId=${encodeURIComponent(alert.id)}${src}`);
  };

  const openAlertThreatMap = (alert: AlertItem) => {
    if (!alert.threatId) return;
    const params = new URLSearchParams();
    params.set('from', 'alerts');
    params.set('threatId', alert.threatId);
    params.set('alertId', alert.id);
    if (alertContext.sourceIp) params.set('sourceIp', alertContext.sourceIp);
    setLocation(`/map?${params.toString()}`);
  };

  const openAlertFlow = (alert: AlertItem) => {
    if (!alert.threatId) return;
    const params = new URLSearchParams();
    params.set('from', 'alerts');
    params.set('view', 'flow');
    params.set('threatId', alert.threatId);
    params.set('alertId', alert.id);
    if (alertContext.sourceIp) {
      params.set('sourceIp', alertContext.sourceIp);
      params.set('focusSourceIp', alertContext.sourceIp);
    }
    setLocation(`/network-activity?${params.toString()}`);
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-alerts">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold flex items-center gap-2"><Bell className="h-6 w-6" /> {t('nav.alerts')}</h2>
          <p className="text-sm text-muted-foreground">{t('alerts.subtitle', 'Real-time security notifications and important system events.')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}><RefreshCw className="h-4 w-4 mr-1" />{t('common.refresh', 'Refresh')}</Button>
          <Button variant="destructive" size="sm" onClick={() => clearAll.mutate()} disabled={(listResp?.total ?? 0) === 0 || clearAll.isPending}>{t('alerts.clearAll', 'Clear All')}</Button>
        </div>
      </div>

      {(resolvedAlertId || selectedThreatId) && (
        <Alert className="border-amber-500/40 bg-amber-500/10">
          <AlertTitle>{t('alerts.focusedAlert', 'Focused alert')}</AlertTitle>
          <AlertDescription className="font-mono text-xs">
            {resolvedAlertId || selectedThreatId}
          </AlertDescription>
        </Alert>
      )}

      {(resolvedAlertId || selectedThreatId) && selectedAlertFound === false && (
        <Alert className="border-amber-500/40 bg-amber-500/10">
          <AlertTitle>{t('alerts.selectedAlertNotFoundTitle', 'Selected alert not found in current filters')}</AlertTitle>
          <AlertDescription>
            {t('alerts.selectedAlertNotFoundDescription', 'Try clearing filters to locate the selected alert.')} 
            <Button
              size="sm"
              variant="link"
              className="px-1 h-auto"
              onClick={() => {
                setSeverityFilter('all');
                setShowUnreadOnly(false);
                setSearch('');
                setPage(1);
              }}
            >
              {t('common.clearFilters', 'Clear Filters')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {(alertContext.from === 'map' || alertContext.from === 'threats' || alertContext.from === 'flow') && (
        <Alert className="border-sky-500/40 bg-sky-500/10">
          <AlertTitle>{t('alerts.contextTitle', 'Focused alert context')}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {alertContext.returnHref && (
              <Link href={alertContext.returnHref}>
                <span className="underline text-sky-700 dark:text-sky-400 cursor-pointer">
                  {alertContext.returnLabel}
                </span>
              </Link>
            )}
            <Link href={alertContext.threatHref}>
              <span className="underline text-sky-700 dark:text-sky-400 cursor-pointer">
                {t('alerts.openThreatLog', 'Open Threat Log')}
              </span>
            </Link>
            <Link href={alertContext.flowHref}>
              <span className="underline text-sky-700 dark:text-sky-400 cursor-pointer">
                {t('alerts.openFlow', 'Open Flow')}
              </span>
            </Link>
            <Link href={alertContext.mapHref}>
              <span className="underline text-sky-700 dark:text-sky-400 cursor-pointer">
                {t('alerts.openThreatMap', 'Open Threat Map')}
              </span>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{t('alerts.total', 'Total')}: {listResp?.total ?? 0}</Badge>
              <Badge variant={unreadCount > 0 ? 'destructive' : 'outline'} className="text-xs" data-testid="badge-unread">{t('alerts.unread', 'Unread')}: {unreadCount}</Badge>
            </div>
            <div className="w-40">
              <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder={t('alerts.filterSeverity', 'Severity')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('alerts.allSeverities', 'All')}</SelectItem>
                  <SelectItem value="critical">{t('severity.critical', 'Critical')}</SelectItem>
                  <SelectItem value="high">{t('severity.high', 'High')}</SelectItem>
                  <SelectItem value="medium">{t('severity.medium', 'Medium')}</SelectItem>
                  <SelectItem value="low">{t('severity.low', 'Low')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant={showUnreadOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setShowUnreadOnly(v => !v); setPage(1); }}
              data-testid="toggle-unread-only"
            >{showUnreadOnly ? t('alerts.showAll', 'Show All') : t('alerts.showUnread', 'Unread Only')}</Button>
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder={t('alerts.search', 'Search alerts...')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                data-testid="alerts-search"
              />
            </div>
            <div className="w-24">
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(parseInt(v, 10)); setPage(1); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-8 text-center" data-testid="alerts-loading">{t('common.loading')}</p>
          ) : displayAlerts.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center" data-testid="alerts-empty">{t('alerts.noAlerts', 'No alerts')}</p>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.time', 'Time')}</TableHead>
                    <TableHead>{t('common.title', 'Title')}</TableHead>
                    <TableHead>{t('common.message', 'Message')}</TableHead>
                    <TableHead>{t('common.severity', 'Severity')}</TableHead>
                    <TableHead className="text-right">{t('common.actions', 'Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayAlerts.map(alert => {
                    const sev = getSeverityConfig(normalizeSeverity(alert.severity as string));
                    return (
                      <TableRow
                        key={alert.id}
                        ref={resolvedAlertId && alert.id === resolvedAlertId ? selectedAlertRowRef : undefined}
                        className={`${alert.read ? 'opacity-60' : ''} ${resolvedAlertId && alert.id === resolvedAlertId ? 'bg-amber-500/10 ring-1 ring-amber-500/40 opacity-100' : ''}`}
                        data-testid={`alerts-row-${alert.id}`}
                      >
                        <TableCell className="whitespace-nowrap text-xs">{formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}</TableCell>
                        <TableCell className="font-medium text-sm max-w-[200px] truncate" title={alert.title}>{alert.title}</TableCell>
                        <TableCell className="text-xs max-w-[320px] truncate" title={alert.message}>{alert.message}</TableCell>
                        <TableCell>
                          <Badge variant={sev.variant as BadgeProps['variant']} className="flex items-center gap-1" data-testid={`severity-${alert.severity}`}>{sev.icon}{alert.severity}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            {alert.threatId && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openAlertFlow(alert)}
                                  data-testid={`open-flow-${alert.id}`}
                                >
                                  {t('alerts.openFlow', 'Open Flow')}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openAlertThreatLog(alert)}
                                  data-testid={`open-threat-log-${alert.id}`}
                                >
                                  {t('alerts.openThreatLog', 'Open Threat Log')}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openAlertThreatMap(alert)}
                                  data-testid={`open-threat-map-${alert.id}`}
                                >
                                  {t('alerts.openThreatMap', 'Open Threat Map')}
                                </Button>
                              </>
                            )}
                            {!alert.read && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => markRead.mutate(alert.id)}
                                data-testid={`mark-read-${alert.id}`}
                              >{t('alerts.markRead', 'Mark Read')}</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {t('common.showing', 'Showing')} {alerts.length} {t('common.of', 'of')} {listResp?.total ?? 0}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1 || isLoading}>
                {t('common.previous', 'Previous')}
              </Button>
              <span className="text-sm">
                {(() => {
                  const total = listResp?.total ?? 0;
                  const pages = Math.max(1, Math.ceil(total / pageSize));
                  return `${page} / ${pages}`;
                })()}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={isLoading || page >= Math.max(1, Math.ceil((listResp?.total ?? 0) / pageSize))}
              >
                {t('common.next', 'Next')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
