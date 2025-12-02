import React from 'react';
import { useQuery } from '@tanstack/react-query';

interface HistoryBucket {
  ts: string;
  active: number;
  blocked: number;
  alerts: number;
  severityCritical?: number;
  severityHigh?: number;
  severityMedium?: number;
  severityLow?: number;
  severityPctCritical?: number;
  severityPctHigh?: number;
  severityPctMedium?: number;
  severityPctLow?: number;
}

const COLOR_MAP = {
  critical: 'bg-destructive',
  high: 'bg-orange-500',
  medium: 'bg-yellow-400',
  low: 'bg-emerald-500'
};

type Severity = 'critical' | 'high' | 'medium' | 'low';
export const SeverityDistributionBar: React.FC<{ className?: string; selectedSeverity?: Severity; onSelectSeverity?: (s?: Severity) => void }> = ({ className, selectedSeverity, onSelectSeverity }) => {
  const historyQuery = useQuery({ queryKey: ['/api/stats/history?hours=24&interval=hour&includeDerived=true'] });
  const history = historyQuery.data as HistoryBucket[] | undefined;
  const last = history?.[history.length - 1];

  const pctCritical = last?.severityPctCritical ?? (function() { const total = (last?.severityCritical||0)+(last?.severityHigh||0)+(last?.severityMedium||0)+(last?.severityLow||0); return total? (last!.severityCritical!/total)*100 : 0; })();
  const pctHigh = last?.severityPctHigh ?? (function() { const total = (last?.severityCritical||0)+(last?.severityHigh||0)+(last?.severityMedium||0)+(last?.severityLow||0); return total? (last!.severityHigh!/total)*100 : 0; })();
  const pctMedium = last?.severityPctMedium ?? (function() { const total = (last?.severityCritical||0)+(last?.severityHigh||0)+(last?.severityMedium||0)+(last?.severityLow||0); return total? (last!.severityMedium!/total)*100 : 0; })();
  const pctLow = last?.severityPctLow ?? (function() { const total = (last?.severityCritical||0)+(last?.severityHigh||0)+(last?.severityMedium||0)+(last?.severityLow||0); return total? (last!.severityLow!/total)*100 : 0; })();

  const loading = historyQuery.isLoading;
  const empty = !loading && (!last || (pctCritical + pctHigh + pctMedium + pctLow) === 0);

  const anomaly = (history && history[history.length - 1] && ((history[history.length - 1] as any).anomalyActive || (history[history.length - 1] as any).anomalyBlocked)) || false;

  const makeLegendItem = (label: string, sev: Severity, pct: number) => (
    <button type="button" onClick={() => onSelectSeverity && onSelectSeverity(selectedSeverity === sev ? undefined : sev)} className={`flex items-center gap-1 text-left ${selectedSeverity === sev ? 'font-semibold text-foreground' : ''}`}>
      <span className={`h-2 w-2 rounded ${COLOR_MAP[sev]}`} />{label} {pct.toFixed(1)}%
    </button>
  );

  return (
    <div className={className} aria-label="severity-distribution" role="group">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground flex items-center gap-2">Severity Distribution (latest)
          {anomaly && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-600/15 text-red-600 font-semibold">ANOMALY</span>}
        </h2>
        {loading && <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>}
      </div>
      {loading ? (
        <div className="h-4 w-full rounded bg-muted animate-pulse" />
      ) : empty ? (
        <div className="text-xs text-muted-foreground">No severity data yet.</div>
      ) : (
        <>
          <div className="flex h-4 w-full overflow-hidden rounded ring-1 ring-border" aria-label="severity-bar ascending">
            <button type="button" onClick={() => onSelectSeverity && onSelectSeverity(selectedSeverity === 'low' ? undefined : 'low')} title={`Low ${pctLow.toFixed(1)}%`} style={{ width: `${pctLow}%` }} className={`${COLOR_MAP.low} transition-all hover:opacity-90 ${selectedSeverity === 'low' ? 'outline outline-2 outline-white/70' : ''}`} />
            <button type="button" onClick={() => onSelectSeverity && onSelectSeverity(selectedSeverity === 'medium' ? undefined : 'medium')} title={`Medium ${pctMedium.toFixed(1)}%`} style={{ width: `${pctMedium}%` }} className={`${COLOR_MAP.medium} transition-all hover:opacity-90 ${selectedSeverity === 'medium' ? 'outline outline-2 outline-white/70' : ''}`} />
            <button type="button" onClick={() => onSelectSeverity && onSelectSeverity(selectedSeverity === 'high' ? undefined : 'high')} title={`High ${pctHigh.toFixed(1)}%`} style={{ width: `${pctHigh}%` }} className={`${COLOR_MAP.high} transition-all hover:opacity-90 ${selectedSeverity === 'high' ? 'outline outline-2 outline-white/70' : ''}`} />
            <button type="button" onClick={() => onSelectSeverity && onSelectSeverity(selectedSeverity === 'critical' ? undefined : 'critical')} title={`Critical ${pctCritical.toFixed(1)}%`} style={{ width: `${pctCritical}%` }} className={`${COLOR_MAP.critical} transition-all hover:opacity-90 ${selectedSeverity === 'critical' ? 'outline outline-2 outline-white/70' : ''}`} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4 text-[10px] text-muted-foreground" aria-label="severity-legend ascending">
            {makeLegendItem('Low', 'low', pctLow)}
            {makeLegendItem('Medium', 'medium', pctMedium)}
            {makeLegendItem('High', 'high', pctHigh)}
            {makeLegendItem('Critical', 'critical', pctCritical)}
          </div>
        </>
      )}
    </div>
  );
};

export default SeverityDistributionBar;
