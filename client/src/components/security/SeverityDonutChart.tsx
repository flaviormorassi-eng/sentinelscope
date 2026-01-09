import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface HistoryBucket {
  ts: string;
  severityCritical?: number;
  severityHigh?: number;
  severityMedium?: number;
  severityLow?: number;
  severityPctCritical?: number;
  severityPctHigh?: number;
  severityPctMedium?: number;
  severityPctLow?: number;
}

const COLORS = {
  critical: 'hsl(var(--destructive))',
  high: 'hsl(27 87% 52%)',
  medium: 'hsl(43 96% 56%)',
  low: 'hsl(173 58% 39%)'
};

type Severity = 'critical' | 'high' | 'medium' | 'low';
export const SeverityDonutChart: React.FC<{ className?: string; selectedSeverity?: Severity; onSelectSeverity?: (s?: Severity) => void }> = ({ className, selectedSeverity, onSelectSeverity }) => {
  const historyQuery = useQuery({ queryKey: ['/api/stats/history?hours=24&interval=hour&includeDerived=true'] });
  const history = Array.isArray(historyQuery.data) ? (historyQuery.data as HistoryBucket[]) : undefined;
  const last = history?.[history.length - 1];

  const totals = {
    critical: last?.severityCritical ?? 0,
    high: last?.severityHigh ?? 0,
    medium: last?.severityMedium ?? 0,
    low: last?.severityLow ?? 0,
  };
  const sum = Object.values(totals).reduce((a,b)=>a+b,0);

  const data = sum === 0 ? [] : [
    { name: 'Low', value: totals.low, color: COLORS.low, key: 'low' as Severity },
    { name: 'Medium', value: totals.medium, color: COLORS.medium, key: 'medium' as Severity },
    { name: 'High', value: totals.high, color: COLORS.high, key: 'high' as Severity },
    { name: 'Critical', value: totals.critical, color: COLORS.critical, key: 'critical' as Severity },
  ];

  return (
    <div className={className} aria-label="severity-donut" role="figure">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">Severity Mix (donut)</h2>
        {historyQuery.isLoading && <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>}
      </div>
      {historyQuery.isLoading ? (
        <div className="h-40 w-full rounded bg-muted animate-pulse" />
      ) : data.length === 0 ? (
        <div className="text-xs text-muted-foreground">No severity data yet.</div>
      ) : (
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}
                onClick={(_, idx) => {
                  const s = data[idx]?.key;
                  if (!s) return;
                  onSelectSeverity && onSelectSeverity(selectedSeverity === s ? undefined : s);
                }}>
                {data.map((entry, idx) => (
                  <Cell key={entry.name} fill={entry.color} stroke={selectedSeverity === entry.key ? 'hsl(var(--foreground))' : 'transparent'} strokeWidth={selectedSeverity === entry.key ? 2 : 1} cursor="pointer" />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      {sum > 0 && (
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-muted-foreground" aria-label="severity-donut-legend ascending">
          {data.map(d => <div key={d.name} className="flex items-center gap-1"><span className="h-2 w-2 rounded" style={{ background: d.color }} />{d.name} {((d.value / sum) * 100).toFixed(1)}%</div>)}
        </div>
      )}
    </div>
  );
};

export default SeverityDonutChart;
