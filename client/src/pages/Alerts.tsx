import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { getSeverityConfig, normalizeSeverity, type SeverityKey } from '../lib/severity';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { AlertTriangle, Bell, CheckCircle, CircleDot, RefreshCw, XCircle } from 'lucide-react';
import { useState, useMemo } from 'react';

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

// Map severity to badge styles
const severityConfig = {
  critical: { variant: 'destructive', icon: <XCircle className="h-4 w-4" />, label: 'critical' },
  high: { variant: 'destructive', icon: <AlertTriangle className="h-4 w-4" />, label: 'high' },
  medium: { variant: 'secondary', icon: <CircleDot className="h-4 w-4" />, label: 'medium' },
  low: { variant: 'outline', icon: <CheckCircle className="h-4 w-4" />, label: 'low' },
} as const satisfies Record<string, { variant: BadgeProps['variant']; icon: JSX.Element; label: string }>;

export default function Alerts() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');

  // Fetch all alerts
  const { data: alerts = [], isLoading, refetch } = useQuery<AlertItem[]>({
    queryKey: ['/api/alerts'],
    refetchInterval: 30000, // auto refresh every 30s
  });

  // Unread count for badge (already used in sidebar but keep local)
  const unreadCount = useMemo(() => alerts.filter(a => !a.read).length, [alerts]);

  // Filtered alerts memo
  const filtered = useMemo(() => {
    return alerts.filter(a => {
      if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
      if (showUnreadOnly && a.read) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!a.title.toLowerCase().includes(s) && !a.message.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [alerts, severityFilter, showUnreadOnly, search]);

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

  return (
    <div className="p-6 space-y-6" data-testid="page-alerts">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold flex items-center gap-2"><Bell className="h-6 w-6" /> {t('nav.alerts')}</h2>
          <p className="text-sm text-muted-foreground">{t('alerts.subtitle', 'Real-time security notifications and important system events.')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}><RefreshCw className="h-4 w-4 mr-1" />{t('common.refresh', 'Refresh')}</Button>
          <Button variant="destructive" size="sm" onClick={() => clearAll.mutate()} disabled={alerts.length === 0 || clearAll.isPending}>{t('alerts.clearAll', 'Clear All')}</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{t('alerts.total', 'Total')}: {alerts.length}</Badge>
              <Badge variant={unreadCount > 0 ? 'destructive' : 'outline'} className="text-xs" data-testid="badge-unread">{t('alerts.unread', 'Unread')}: {unreadCount}</Badge>
            </div>
            <div className="w-40">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
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
              onClick={() => setShowUnreadOnly(v => !v)}
              data-testid="toggle-unread-only"
            >{showUnreadOnly ? t('alerts.showAll', 'Show All') : t('alerts.showUnread', 'Unread Only')}</Button>
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder={t('alerts.search', 'Search alerts...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="alerts-search"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-8 text-center" data-testid="alerts-loading">{t('common.loading')}</p>
          ) : filtered.length === 0 ? (
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
                  {filtered.map(alert => {
                    const sev = getSeverityConfig(normalizeSeverity(alert.severity as string));
                    return (
                      <TableRow key={alert.id} className={alert.read ? 'opacity-60' : ''} data-testid={`alerts-row-${alert.id}`}>
                        <TableCell className="whitespace-nowrap text-xs">{formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}</TableCell>
                        <TableCell className="font-medium text-sm max-w-[200px] truncate" title={alert.title}>{alert.title}</TableCell>
                        <TableCell className="text-xs max-w-[320px] truncate" title={alert.message}>{alert.message}</TableCell>
                        <TableCell>
                          <Badge variant={sev.variant as BadgeProps['variant']} className="flex items-center gap-1" data-testid={`severity-${alert.severity}`}>{sev.icon}{alert.severity}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {!alert.read && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => markRead.mutate(alert.id)}
                              data-testid={`mark-read-${alert.id}`}
                            >{t('alerts.markRead', 'Mark Read')}</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
