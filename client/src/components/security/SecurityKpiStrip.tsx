import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { cn } from '../../lib/utils';

interface StatItem {
  label: string;
  value: number | string;
  trend?: number; // positive or negative percentage
  loading?: boolean;
  severity?: 'neutral' | 'good' | 'warn' | 'bad';
  tooltip?: string;
  anomaly?: boolean; // flag to display anomaly badge
}

function formatTrend(trend?: number) {
  if (trend === undefined || trend === null) return '';
  const sign = trend > 0 ? '+' : '';
  return `${sign}${trend.toFixed(1)}%`;
}

// Simple sparkline placeholder (can be replaced later with real canvas chart)
function Sparkline({ severity }: { severity?: StatItem['severity'] }) {
  const color = severity === 'bad' ? 'stroke-red-500' : severity === 'warn' ? 'stroke-amber-500' : severity === 'good' ? 'stroke-emerald-500' : 'stroke-blue-500';
  return (
    <svg viewBox="0 0 50 12" className={cn('w-full h-3', color)} fill="none">
      <polyline points="0,10 10,2 20,8 30,4 40,9 50,5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KpiCard({ item }: { item: StatItem }) {
  return (
    <div className="relative rounded-md border bg-card p-3 flex flex-col gap-1 min-w-[160px] shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground font-medium tracking-wide uppercase">{item.label}</div>
        {item.anomaly && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-600/15 text-red-600 font-semibold tracking-wide">ANOMALY</span>
        )}
      </div>
      <div className="text-lg font-semibold flex items-baseline gap-2">
        {item.loading ? <span className="animate-pulse w-8 h-4 bg-muted rounded" /> : item.value}
        {item.trend !== undefined && (
          <span className={cn('text-xs font-medium', item.trend > 0 ? 'text-emerald-600' : item.trend < 0 ? 'text-red-600' : 'text-muted-foreground')}>
            {formatTrend(item.trend)}
          </span>
        )}
      </div>
      <Sparkline severity={item.severity} />
      {item.tooltip && (
        <div className="mt-1 text-[10px] text-muted-foreground line-clamp-2" title={item.tooltip}>{item.tooltip}</div>
      )}
    </div>
  );
}

export const SecurityKpiStrip: React.FC = () => {
  // Base stats (demo vs real handled server-side)
  const statsQuery = useQuery({ queryKey: ['/api/stats'] });
  // Historical stats for trends
  const historyQuery = useQuery({ queryKey: ['/api/stats/history?hours=24&interval=hour&includeDerived=true'] });

  // Recent auth failures (admin only; may 403)
  const authFailuresQuery = useQuery({
    queryKey: ['/api/compliance/audit-logs?eventCategory=authentication&limit=20'],
    retry: 0,
  });

  const stats = statsQuery.data as { active: number; blocked: number; alerts: number } | undefined;
  const history = historyQuery.data as Array<{ ts: string; active: number; blocked: number; alerts: number; blockedRatio?: number; severityPctCritical?: number; severityPctHigh?: number; severityPctMedium?: number; severityPctLow?: number; anomalyActive?: boolean; anomalyBlocked?: boolean }> | undefined;
  const authLogs: any[] | undefined = authFailuresQuery.isError ? undefined : (authFailuresQuery.data as any[] | undefined);

  // Compute derived metrics (placeholders until more endpoints exist)
  const failedAuthCount = authLogs ? authLogs.filter(l => l.status === 'failure').length : null;

  // Compute trends from last two buckets
  const last = history && history.length >= 2 ? history[history.length - 1] : undefined;
  const prev = history && history.length >= 2 ? history[history.length - 2] : undefined;
  const pct = (curr?: number, prevv?: number) => {
    if (curr === undefined || prevv === undefined) return undefined;
    if (prevv === 0) return curr > 0 ? 100 : 0;
    return ((curr - prevv) / prevv) * 100;
  };

  const lastBucket = history?.[history.length - 1];
  const items: StatItem[] = [
    {
      label: 'Active Threats',
      value: stats?.active ?? 0,
      loading: statsQuery.isLoading || historyQuery.isLoading,
      trend: pct(last?.active, prev?.active),
      severity: (lastBucket?.anomalyActive ? 'bad' : (stats && stats.active > 50 ? 'bad' : stats && stats.active > 10 ? 'warn' : 'neutral')),
      anomaly: !!lastBucket?.anomalyActive,
      tooltip: lastBucket ? `Active detected threats. Critical ${lastBucket.severityPctCritical ?? 0}%, High ${lastBucket.severityPctHigh ?? 0}%, Medium ${lastBucket.severityPctMedium ?? 0}%.` : 'Threat events currently in detected state.'
    },
    {
      label: 'Blocked',
      value: stats?.blocked ?? 0,
      loading: statsQuery.isLoading || historyQuery.isLoading,
      trend: pct(last?.blocked, prev?.blocked),
      severity: lastBucket?.anomalyBlocked ? 'warn' : (stats && stats.blocked > 0 ? 'good' : 'neutral'),
      anomaly: !!lastBucket?.anomalyBlocked,
      tooltip: lastBucket ? `Blocked threats (ratio ${((lastBucket.blockedRatio ?? 0) * 100).toFixed(1)}% of active).` : 'Threats auto-blocked or mitigated.'
    },
    {
      label: 'Alerts (24h)',
      value: stats?.alerts ?? 0,
      loading: statsQuery.isLoading || historyQuery.isLoading,
      trend: pct(last?.alerts, prev?.alerts),
      severity: 'neutral',
      tooltip: 'New alerts since midnight.'
    },
    {
      label: 'Auth Failures',
      value: failedAuthCount === null ? '—' : failedAuthCount,
      loading: authFailuresQuery.isLoading,
      severity: failedAuthCount && failedAuthCount > 25 ? 'bad' : failedAuthCount && failedAuthCount > 5 ? 'warn' : 'neutral',
      tooltip: 'Recent authentication failures (admin only). 403 hides data.'
    }
  ];

  return (
    <div className="grid gap-3 md:grid-cols-4 sm:grid-cols-2">
      {items.map(i => <KpiCard key={i.label} item={i} />)}
    </div>
  );
};

export default SecurityKpiStrip;
