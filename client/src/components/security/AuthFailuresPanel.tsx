import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import type { User } from '../../../../shared/schema';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId?: string | null;
  eventType: string;
  eventCategory: string;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  status: string;
  severity: string;
  metadata?: any;
}

const ACTION_LABELS: Record<string, string> = {
  missing_token: 'Missing Token',
  invalid_or_expired_token: 'Invalid/Expired Token',
  no_user_identity: 'No User Identity',
  internal_error: 'Auth Internal Error',
  optional_invalid_token: 'Optional Invalid Token',
  api_key_missing: 'Missing API Key',
  api_key_invalid: 'Invalid API Key',
  event_source_inactive: 'Inactive Event Source',
  ip_blocked_source: 'Blocked Source IP',
  ip_blocked_destination: 'Blocked Destination IP',
  ip_blocked_browsing: 'Blocked Browsing IP',
};

function severityColor(sev: string) {
  switch (sev) {
    case 'critical': return 'bg-red-600/90';
    case 'high': return 'bg-red-500/80';
    case 'medium': return 'bg-amber-500/80';
    case 'warning': return 'bg-yellow-400/80 text-black';
    case 'low': return 'bg-sky-400/80';
    default: return 'bg-muted';
  }
}

export const AuthFailuresPanel: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Fetch current user to determine admin privileges
  const { data: currentUser } = useQuery<User>({
    queryKey: [`/api/user/${user?.uid}`],
    enabled: !!user?.uid,
  });
  const isAdmin = currentUser?.isAdmin || false;

  const query = useQuery({
    queryKey: ['/api/compliance/audit-logs?eventCategory=authentication&limit=50'],
    retry: 0,
    enabled: isAdmin, // Only attempt fetch if admin
  });

  const logs = (query.data as AuditLogEntry[] | undefined) || [];
  const failureLogsRaw = logs.filter(l => l.status === 'failure');

  type SortKey = 'timestamp' | 'action' | 'ipAddress' | 'severity' | 'resource';
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const failureLogs = useMemo(() => {
    const arr = [...failureLogsRaw];
    arr.sort((a, b) => {
      let av: any; let bv: any;
      switch (sortKey) {
        case 'timestamp': av = new Date(a.timestamp).getTime(); bv = new Date(b.timestamp).getTime(); break;
        case 'action': av = a.action || ''; bv = b.action || ''; break;
        case 'ipAddress': av = a.ipAddress || ''; bv = b.ipAddress || ''; break;
        case 'severity': av = a.severity || ''; bv = b.severity || ''; break;
        case 'resource': av = (a.resourceId || a.resourceType || '') ; bv = (b.resourceId || b.resourceType || ''); break;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [failureLogsRaw, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'timestamp' ? 'desc' : 'asc');
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide uppercase">{t('authFailures.title')}</h2>
        {isAdmin && query.isLoading && <span className="text-xs text-muted-foreground">{t('authFailures.loading')}</span>}
      </div>
      <div className="text-xs text-muted-foreground">
        {t('authFailures.description')}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-xs text-muted-foreground border-b select-none">
              <th className="py-1 pr-2 text-left font-medium cursor-pointer" onClick={() => toggleSort('timestamp')}>
                {t('authFailures.headers.time')}{sortKey==='timestamp' ? (sortDir==='asc'?' ▲':' ▼'):''}
              </th>
              <th className="py-1 pr-2 text-left font-medium cursor-pointer" onClick={() => toggleSort('action')}>
                {t('authFailures.headers.action')}{sortKey==='action' ? (sortDir==='asc'?' ▲':' ▼'):''}
              </th>
              <th className="py-1 pr-2 text-left font-medium cursor-pointer" onClick={() => toggleSort('ipAddress')}>
                {t('authFailures.headers.ip')}{sortKey==='ipAddress' ? (sortDir==='asc'?' ▲':' ▼'):''}
              </th>
              <th className="py-1 pr-2 text-left font-medium cursor-pointer" onClick={() => toggleSort('severity')}>
                {t('authFailures.headers.severity')}{sortKey==='severity' ? (sortDir==='asc'?' ▲':' ▼'):''}
              </th>
              <th className="py-1 pr-2 text-left font-medium cursor-pointer" onClick={() => toggleSort('resource')}>
                {t('authFailures.headers.resource')}{sortKey==='resource' ? (sortDir==='asc'?' ▲':' ▼'):''}
              </th>
            </tr>
          </thead>
          <tbody>
            {failureLogs.slice(0, 25).map(l => {
              const actionLabel = ACTION_LABELS[l.action] || l.action;
              return (
                <tr key={l.id} className="border-b last:border-b-0 hover:bg-muted/50">
                   <td className="py-1 pr-2 whitespace-nowrap">
                     {(() => {
                       const rawLocale = t('app.locale', { defaultValue: 'en-US' }) as string;
                       const locale = /^[a-z]{2}(-[A-Z]{2})?$/.test(rawLocale) ? rawLocale : 'en-US';
                       return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(l.timestamp));
                     })()}
                   </td>
                  <td className="py-1 pr-2 max-w-[160px] truncate" title={l.action}>{actionLabel}</td>
                   <td className="py-1 pr-2 whitespace-nowrap">{l.ipAddress || '—'}</td>
                  <td className="py-1 pr-2">
                    <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium text-white', severityColor(l.severity))}>{t(`threats.severityLevels.${l.severity}`, { defaultValue: l.severity })}</span>
                  </td>
                  <td className="py-1 pr-2 whitespace-nowrap">{l.resourceId || l.resourceType || '—'}</td>
                </tr>
              );
            })}
            {isAdmin && failureLogs.length === 0 && !query.isLoading && !query.isError && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-xs text-muted-foreground">{t('authFailures.empty')}</td>
              </tr>
            )}
            {!isAdmin && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-xs text-muted-foreground">{t('authFailures.unauthorized')}</td>
              </tr>
            )}
            {isAdmin && query.isError && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-xs text-red-600">{t('common.error')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {isAdmin && failureLogs.length > 25 && (
        <div className="text-[11px] text-muted-foreground">
          {t('authFailures.showingSome', { shown: 25, total: failureLogs.length })}
        </div>
      )}
    </div>
  );
};

export default AuthFailuresPanel;
