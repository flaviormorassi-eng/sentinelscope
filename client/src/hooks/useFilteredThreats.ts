import { useMemo } from 'react';
import type { Threat, ThreatEvent } from '@shared/schema';
import type { Severity } from '@/components/security/ThreatFiltersBar';

export function useFilteredThreats(
  threats: Array<Threat | ThreatEvent>,
  opts: {
    severity?: Severity;
    type?: string;
    sourceQuery?: string;
  }
) {
  const { severity, type, sourceQuery } = opts;

  const filtered = useMemo(() => {
    if (!Array.isArray(threats) || threats.length === 0) return [] as Array<Threat | ThreatEvent>;
    const q = (sourceQuery || '').toLowerCase();

    return threats
      .filter((th: any) => th && typeof th === 'object')
      .filter((th: any) => !severity || th.severity === severity)
      .filter((th: any) => !type || (("threatType" in th ? th.threatType : th.type) === type))
      .filter((th: any) => {
        if (!q) return true;
        const srcReal = (th.sourceURL || th.deviceName || th.sourceIP || "") as string;
        const srcDemo = (th.sourceIP || "") as string;
        const combined = (("threatType" in th) ? srcReal : srcDemo).toLowerCase();
        return combined.includes(q);
      });
  }, [threats, severity, type, sourceQuery]);

  return {
    filtered,
    count: filtered.length,
  } as const;
}
