import { XCircle, AlertTriangle, CircleDot, CheckCircle } from 'lucide-react';
import type { BadgeProps } from '../components/ui/badge';
import React from 'react';

export type SeverityKey = 'critical' | 'high' | 'medium' | 'low';

const MAP: Record<SeverityKey, { variant: BadgeProps['variant']; icon: JSX.Element; label: string }> = {
  critical: { variant: 'destructive', icon: <XCircle className="h-4 w-4" />, label: 'critical' },
  high: { variant: 'destructive', icon: <AlertTriangle className="h-4 w-4" />, label: 'high' },
  medium: { variant: 'secondary', icon: <CircleDot className="h-4 w-4" />, label: 'medium' },
  low: { variant: 'outline', icon: <CheckCircle className="h-4 w-4" />, label: 'low' },
};

export function getSeverityConfig(sev: SeverityKey): { variant: BadgeProps['variant']; icon: JSX.Element; label: string } {
  return MAP[sev];
}

export function normalizeSeverity(raw: string | null | undefined): SeverityKey {
  if (!raw) return 'low';
  const v = raw.toLowerCase();
  if (v === 'critical' || v === 'high' || v === 'medium' || v === 'low') return v;
  return 'low';
}
