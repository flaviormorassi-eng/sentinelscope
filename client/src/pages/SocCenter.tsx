import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Radar, ShieldCheck, Siren, TimerReset } from 'lucide-react';

type SocIncident = {
  id: string;
  threatId: string;
  timestamp: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | string;
  threatType: string;
  status: string;
  sourceType: 'email' | 'download' | 'link' | 'dns' | 'system' | string;
  sourceIP?: string | null;
  sourceURL?: string | null;
  deviceName?: string | null;
  description?: string | null;
  emailFrom?: string | null;
  emailSubject?: string | null;
  downloadName?: string | null;
  localPath?: string | null;
  processName?: string | null;
  hash?: string | null;
  dnsQuery?: string | null;
  dnsQueryType?: string | null;
  dnsResponseCode?: string | null;
  dnsResolver?: string | null;
  dnsProtocol?: string | null;
  dnsEncrypted?: boolean | null;
};

type SocResponse = {
  data: SocIncident[];
  total: number;
  limit: number;
  offset: number;
  mode: 'demo' | 'real';
  hours: number;
};

type SocCase = {
  id: string;
  userId: string;
  incidentId: string;
  owner?: string | null;
  notes?: string | null;
  caseStatus: 'open' | 'in_progress' | 'resolved' | 'closed' | string;
  slaDueAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type SocCaseResponse = {
  data: SocCase | null;
};

type SocCaseEvent = {
  id: string;
  userId: string;
  incidentId: string;
  eventType: string;
  actorId?: string | null;
  fromValue?: string | null;
  toValue?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
};

type SocCaseEventsResponse = {
  data: SocCaseEvent[];
  limit: number;
};

type SocKpisResponse = {
  data: {
    hours: number;
    mode: 'demo' | 'real' | string;
    incidentsInWindow: number;
    totalCases: number;
    openCases: number;
    resolvedCases: number;
    slaBreaches: number;
    avgMttdMinutes: number | null;
    avgMttrMinutes: number | null;
    previous: {
      incidentsInWindow: number;
      totalCases: number;
      openCases: number;
      resolvedCases: number;
      slaBreaches: number;
      avgMttdMinutes: number | null;
      avgMttrMinutes: number | null;
    };
    deltas: {
      openCases: number;
      resolvedCases: number;
      slaBreaches: number;
      avgMttdMinutes: number | null;
      avgMttrMinutes: number | null;
    };
  };
};

function severityBadgeVariant(severity: string): 'destructive' | 'secondary' | 'default' | 'outline' {
  if (severity === 'critical' || severity === 'high') return 'destructive';
  if (severity === 'medium') return 'secondary';
  return 'outline';
}

type SocCenterProps = {
  embedded?: boolean;
};

export default function SocCenter({ embedded = false }: SocCenterProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [source, setSource] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [hours, setHours] = useState('24');
  const [emailOnly, setEmailOnly] = useState(false);
  const [downloadOnly, setDownloadOnly] = useState(false);
  const [selected, setSelected] = useState<SocIncident | null>(null);
  const [caseOwner, setCaseOwner] = useState('');
  const [caseNotes, setCaseNotes] = useState('');
  const [caseStatus, setCaseStatus] = useState('open');
  const [caseSlaDueAt, setCaseSlaDueAt] = useState('');
  const [trustedResolversInput, setTrustedResolversInput] = useState('');
  const [dnsDetectionEnabled, setDnsDetectionEnabled] = useState(true);
  const incidentRowRefs = useRef<Array<HTMLTableRowElement | null>>([]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', '100');
    params.set('offset', '0');
    params.set('hours', hours);
    if (q.trim()) params.set('q', q.trim());
    if (source !== 'all') params.set('source', source);
    if (severity !== 'all') params.set('sev', severity);
    if (emailOnly) params.set('emailOnly', '1');
    if (downloadOnly) params.set('downloadOnly', '1');
    return params.toString();
  }, [q, source, severity, hours, emailOnly, downloadOnly]);

  const { data, isLoading } = useQuery<SocResponse>({
    queryKey: [`/api/soc/incidents?${queryString}`],
  });

  const { data: kpiResp } = useQuery<SocKpisResponse>({
    queryKey: [`/api/soc/kpis?hours=${hours}`],
  });

  const { data: dnsPolicyResp } = useQuery<{ data: { trustedDnsResolvers: string; dnsDetectionEnabled: boolean } }>({
    queryKey: ['/api/soc/dns-policy'],
  });

  const { data: socCaseData, isLoading: caseLoading } = useQuery<SocCaseResponse>({
    queryKey: [`/api/soc/cases/${selected?.id || ''}`],
    enabled: !!selected?.id,
  });

  const { data: caseEventsData, isLoading: caseEventsLoading } = useQuery<SocCaseEventsResponse>({
    queryKey: [`/api/soc/cases/${selected?.id || ''}/events?limit=20`],
    enabled: !!selected?.id,
  });

  useEffect(() => {
    const socCase = socCaseData?.data;
    setCaseOwner(socCase?.owner || '');
    setCaseNotes(socCase?.notes || '');
    setCaseStatus(socCase?.caseStatus || 'open');
    setCaseSlaDueAt(socCase?.slaDueAt ? new Date(socCase.slaDueAt).toISOString().slice(0, 16) : '');
  }, [socCaseData?.data?.id, selected?.id]);

  useEffect(() => {
    setTrustedResolversInput(dnsPolicyResp?.data?.trustedDnsResolvers || '');
    setDnsDetectionEnabled(dnsPolicyResp?.data?.dnsDetectionEnabled ?? true);
  }, [dnsPolicyResp?.data?.trustedDnsResolvers, dnsPolicyResp?.data?.dnsDetectionEnabled]);

  const decisionMutation = useMutation({
    mutationFn: async ({ threatId, decision, reason }: { threatId: string; decision: 'block' | 'allow' | 'unblock'; reason: string }) => {
      return await apiRequest('POST', `/api/threats/${threatId}/decide`, {
        decision,
        reason,
      });
    },
    onSuccess: (_result, vars) => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const firstKey = query.queryKey?.[0];
          return typeof firstKey === 'string' && firstKey.startsWith('/api/soc/incidents?');
        },
      });
      queryClient.invalidateQueries({ queryKey: ['threats/list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/alerts/list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });

      setSelected((prev) => {
        if (!prev || prev.threatId !== vars.threatId) return prev;
        const nextStatus = vars.decision === 'block' ? 'blocked' : vars.decision === 'allow' ? 'allowed' : 'pending_review';
        return { ...prev, status: nextStatus };
      });

      toast({
        title: t('admin.decisionRecorded', 'Decision Recorded'),
        description: t('admin.threatDecisionSuccess', 'Your threat decision has been recorded successfully'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error', 'Error'),
        description: error?.message || t('admin.threatDecisionError', 'Failed to record threat decision'),
        variant: 'destructive',
      });
    },
  });

  const incidents = data?.data || [];

  const saveCaseMutation = useMutation({
    mutationFn: async () => {
      if (!selected?.id) throw new Error('No incident selected');
      return await apiRequest('PUT', `/api/soc/cases/${selected.id}`, {
        owner: caseOwner.trim(),
        notes: caseNotes.trim(),
        caseStatus,
        slaDueAt: caseSlaDueAt ? new Date(caseSlaDueAt).toISOString() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/soc/cases/${selected?.id || ''}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/soc/cases/${selected?.id || ''}/events?limit=20`] });
      queryClient.invalidateQueries({ queryKey: [`/api/soc/kpis?hours=${hours}`] });
      toast({
        title: t('common.saved', 'Saved'),
        description: t('soc.caseSaved', 'SOC case details updated.'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error', 'Error'),
        description: error?.message || t('soc.caseSaveError', 'Failed to update SOC case details.'),
        variant: 'destructive',
      });
    },
  });

  const saveDnsPolicyMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('PUT', '/api/soc/dns-policy', {
        trustedDnsResolvers: trustedResolversInput,
        dnsDetectionEnabled,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/soc/dns-policy'] });
      toast({
        title: t('common.saved', 'Saved'),
        description: t('soc.dnsPolicySaved', 'DNS policy updated.'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error', 'Error'),
        description: error?.message || t('soc.dnsPolicySaveError', 'Failed to save DNS policy.'),
        variant: 'destructive',
      });
    },
  });

  const slaTimerText = useMemo(() => {
    if (!caseSlaDueAt) return t('soc.slaNotSet', 'No SLA set');
    const dueMs = new Date(caseSlaDueAt).getTime();
    if (Number.isNaN(dueMs)) return t('soc.slaInvalid', 'Invalid SLA date');
    const diffMs = dueMs - Date.now();
    const absMins = Math.floor(Math.abs(diffMs) / 60000);
    const hoursLeft = Math.floor(absMins / 60);
    const minsLeft = absMins % 60;
    if (diffMs < 0) return `${t('soc.slaOverdue', 'Overdue by')} ${hoursLeft}h ${minsLeft}m`;
    return `${t('soc.slaRemaining', 'Remaining')} ${hoursLeft}h ${minsLeft}m`;
  }, [caseSlaDueAt, t]);

  const formatMinutesCompact = (minutes: number | null) => {
    if (minutes === null || Number.isNaN(minutes)) return '-';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    return `${hours}h ${remMinutes}m`;
  };

  const formatDeltaCount = (delta: number | null | undefined) => {
    if (delta === null || delta === undefined || delta === 0) return '↔ 0 vs prev';
    return `${delta > 0 ? '↑' : '↓'} ${delta > 0 ? '+' : ''}${delta} vs prev`;
  };

  const formatDeltaMinutes = (delta: number | null | undefined) => {
    if (delta === null || delta === undefined || delta === 0) return '↔ 0m vs prev';
    const abs = Math.abs(delta);
    return `${delta > 0 ? '↑' : '↓'} ${delta > 0 ? '+' : '-'}${abs}m vs prev`;
  };

  const meaningForDelta = (
    delta: number | null | undefined,
    direction: 'lower_is_better' | 'higher_is_better',
  ) => {
    if (delta === null || delta === undefined || delta === 0) {
      return t('soc.kpiNoChange', 'No change');
    }
    const improved = direction === 'lower_is_better' ? delta < 0 : delta > 0;
    return improved ? t('soc.kpiImproved', 'Improved') : t('soc.kpiWorse', 'Worse');
  };

  const kpis = kpiResp?.data;
  const caseEvents = caseEventsData?.data || [];
  const hasEscalationEvent = caseEvents.some((event) => event.eventType === 'sla_breached');

  const formatCaseEventLabel = (eventType: string) => {
    switch (eventType) {
      case 'case_created':
        return t('soc.timeline.caseCreated', 'Case created');
      case 'status_changed':
        return t('soc.timeline.statusChanged', 'Status changed');
      case 'owner_changed':
        return t('soc.timeline.ownerChanged', 'Owner changed');
      case 'sla_changed':
        return t('soc.timeline.slaChanged', 'SLA changed');
      case 'notes_updated':
        return t('soc.timeline.notesUpdated', 'Notes updated');
      default:
        return eventType;
    }
  };

  const runPlaybook = (decision: 'block' | 'allow' | 'unblock') => {
    if (!selected?.threatId) return;

    const playbookReasons: Record<'block' | 'allow' | 'unblock', string> = {
      block: `SOC playbook: containment action for ${selected.sourceType || 'incident'} evidence`,
      allow: `SOC playbook: marked benign after evidence review (${selected.sourceType || 'incident'})`,
      unblock: `SOC playbook: returned to review queue for analyst follow-up`,
    };

    decisionMutation.mutate({
      threatId: selected.threatId,
      decision,
      reason: playbookReasons[decision],
    });
  };

  const copyEvidence = async () => {
    if (!selected) return;

    const lines = [
      `Threat Type: ${selected.threatType || '-'}`,
      `Observed At: ${selected.timestamp ? new Date(selected.timestamp).toISOString() : '-'}`,
      `Source Type: ${selected.sourceType || '-'}`,
      `Status: ${selected.status || '-'}`,
      `Severity: ${selected.severity || '-'}`,
      `Email From: ${selected.emailFrom || '-'}`,
      `Email Subject: ${selected.emailSubject || '-'}`,
      `Download Name: ${selected.downloadName || '-'}`,
      `Source URL: ${selected.sourceURL || '-'}`,
      `Local Path: ${selected.localPath || '-'}`,
      `Process Name: ${selected.processName || '-'}`,
      `Hash: ${selected.hash || '-'}`,
      `Description: ${selected.description || '-'}`,
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast({
        title: t('common.copied', 'Copied'),
        description: t('soc.evidenceCopied', 'Incident evidence copied to clipboard.'),
      });
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: t('soc.evidenceCopyFailed', 'Failed to copy incident evidence.'),
        variant: 'destructive',
      });
    }
  };

  const copyEvidenceJson = async () => {
    if (!selected) return;

    const payload = {
      threatType: selected.threatType || null,
      observedAt: selected.timestamp ? new Date(selected.timestamp).toISOString() : null,
      sourceType: selected.sourceType || null,
      status: selected.status || null,
      severity: selected.severity || null,
      emailFrom: selected.emailFrom || null,
      emailSubject: selected.emailSubject || null,
      downloadName: selected.downloadName || null,
      sourceURL: selected.sourceURL || null,
      localPath: selected.localPath || null,
      processName: selected.processName || null,
      hash: selected.hash || null,
      description: selected.description || null,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      toast({
        title: t('common.copied', 'Copied'),
        description: t('soc.evidenceJsonCopied', 'Incident evidence JSON copied to clipboard.'),
      });
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: t('soc.evidenceJsonCopyFailed', 'Failed to copy incident evidence JSON.'),
        variant: 'destructive',
      });
    }
  };

  const handleIncidentRowKeyDown = (
    event: React.KeyboardEvent<HTMLTableRowElement>,
    index: number,
    incident: SocIncident,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelected(incident);
      return;
    }

    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    event.preventDefault();
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(incidents.length - 1, index + delta));
    const nextIncident = incidents[nextIndex];
    if (!nextIncident) return;

    setSelected(nextIncident);
    requestAnimationFrame(() => {
      incidentRowRefs.current[nextIndex]?.focus();
    });
  };

  return (
    <div className={embedded ? 'space-y-4' : 'p-4 md:p-5 space-y-4'} data-testid="page-soc-center">
      <Card className="relative overflow-hidden border-border/60">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-chart-3/10" />
        <CardContent className="relative p-4 md:p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-md border bg-background/70 px-2.5 py-1 text-xs uppercase tracking-wide text-muted-foreground">
                <Radar className="h-3.5 w-3.5 text-primary" />
                {t('soc.commandBridge', 'SOC Command Bridge')}
              </div>
              {!embedded && <h1 className="text-3xl font-bold tracking-tight">{t('soc.title', 'SOC Center')}</h1>}
              <p className="text-muted-foreground">
                {t('soc.subtitle', 'Monitor incidents from links, downloads, and email vectors with forensic context.')}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-md border bg-background/70 px-3 py-2 min-w-[170px]">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('soc.openCasesSignal', 'Open Cases')}</p>
                <p className="text-sm font-semibold flex items-center gap-2"><Siren className="h-4 w-4 text-destructive" />{kpis?.openCases ?? 0}</p>
              </div>
              <div className="rounded-md border bg-background/70 px-3 py-2 min-w-[170px]">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('soc.slaWatch', 'SLA Watch')}</p>
                <p className="text-sm font-semibold flex items-center gap-2"><TimerReset className="h-4 w-4 text-chart-4" />{kpis?.slaBreaches ?? 0}</p>
              </div>
              <div className="rounded-md border bg-background/70 px-3 py-2 min-w-[170px]">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('soc.resolvedCasesSignal', 'Resolved')}</p>
                <p className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />{kpis?.resolvedCases ?? 0}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="sticky top-0 z-20 -mx-2 px-2 py-2 bg-background/80 backdrop-blur-sm border-y">
        <div className="flex items-center gap-2 overflow-x-auto">
          <Badge variant="outline" className="whitespace-nowrap">{t('soc.quickNav', 'Quick Nav')}</Badge>
          <Button size="sm" variant="outline" onClick={() => document.getElementById('soc-section-filters')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{t('soc.filters', 'Filters')}</Button>
          <Button size="sm" variant="outline" onClick={() => document.getElementById('soc-section-dns')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{t('soc.dnsPolicyTitle', 'DNS Security Policy')}</Button>
          <Button size="sm" variant="outline" onClick={() => document.getElementById('soc-section-kpis')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{t('soc.kpis', 'KPIs')}</Button>
          <Button size="sm" variant="outline" onClick={() => document.getElementById('soc-section-incidents')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{t('soc.incidents', 'Incidents')}</Button>
          {selected && (
            <Button size="sm" variant="outline" onClick={() => document.getElementById('soc-section-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{t('soc.details', 'Incident Details')}</Button>
          )}
        </div>
      </div>

      <Card id="soc-section-filters">
        <CardHeader className="pb-2">
          <CardTitle>{t('soc.filters', 'Filters')}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1.5 lg:col-span-3">
            <Label htmlFor="soc-search">{t('soc.search', 'Search')}</Label>
            <Input
              id="soc-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('soc.searchPlaceholder', 'Search by threat, email, URL, download name, or path')}
              data-testid="soc-search-input"
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('soc.source', 'Source')}</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger data-testid="soc-source-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('soc.allSources', 'All sources')}</SelectItem>
                <SelectItem value="email">{t('soc.sourceEmail', 'Email')}</SelectItem>
                <SelectItem value="download">{t('soc.sourceDownload', 'Download')}</SelectItem>
                <SelectItem value="link">{t('soc.sourceLink', 'Link')}</SelectItem>
                <SelectItem value="dns">{t('soc.sourceDns', 'DNS')}</SelectItem>
                <SelectItem value="system">{t('soc.sourceSystem', 'System')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t('soc.severity', 'Severity')}</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger data-testid="soc-severity-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('soc.allSeverities', 'All severities')}</SelectItem>
                <SelectItem value="critical">{t('threats.severityLevels.critical', 'Critical')}</SelectItem>
                <SelectItem value="high">{t('threats.severityLevels.high', 'High')}</SelectItem>
                <SelectItem value="medium">{t('threats.severityLevels.medium', 'Medium')}</SelectItem>
                <SelectItem value="low">{t('threats.severityLevels.low', 'Low')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t('soc.timeWindow', 'Time window')}</Label>
            <Select value={hours} onValueChange={setHours}>
              <SelectTrigger data-testid="soc-hours-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{t('soc.lastHour', 'Last 1 hour')}</SelectItem>
                <SelectItem value="6">{t('soc.last6Hours', 'Last 6 hours')}</SelectItem>
                <SelectItem value="24">{t('soc.last24Hours', 'Last 24 hours')}</SelectItem>
                <SelectItem value="168">{t('soc.last7Days', 'Last 7 days')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 lg:col-span-2">
            <Switch
              checked={emailOnly}
              onCheckedChange={setEmailOnly}
              id="soc-email-only"
              data-testid="soc-email-only"
            />
            <Label htmlFor="soc-email-only">{t('soc.emailOnly', 'Email evidence only')}</Label>
          </div>

          <div className="flex items-center gap-2 lg:col-span-2">
            <Switch
              checked={downloadOnly}
              onCheckedChange={setDownloadOnly}
              id="soc-download-only"
              data-testid="soc-download-only"
            />
            <Label htmlFor="soc-download-only">{t('soc.downloadOnly', 'Download evidence only')}</Label>
          </div>
        </CardContent>
      </Card>

      <Card id="soc-section-dns" data-testid="soc-dns-policy-card">
        <CardHeader className="pb-2">
          <CardTitle>{t('soc.dnsPolicyTitle', 'DNS Security Policy')}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="soc-trusted-resolvers">
              {t('soc.trustedResolvers', 'Trusted DNS resolvers (comma-separated IPs/hosts)')}
            </Label>
            <Input
              id="soc-trusted-resolvers"
              value={trustedResolversInput}
              onChange={(e) => setTrustedResolversInput(e.target.value)}
              placeholder={t('soc.trustedResolversPlaceholder', '8.8.8.8,1.1.1.1,dns.company.local')}
              data-testid="soc-trusted-resolvers-input"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={dnsDetectionEnabled}
              onCheckedChange={setDnsDetectionEnabled}
              id="soc-dns-detection-enabled"
              data-testid="soc-dns-detection-enabled"
            />
            <Label htmlFor="soc-dns-detection-enabled">
              {t('soc.dnsDetectionEnabled', 'Enable DNS detections')}
            </Label>
            <Button
              size="sm"
              className="ml-auto"
              onClick={() => saveDnsPolicyMutation.mutate()}
              disabled={saveDnsPolicyMutation.isPending}
              data-testid="soc-dns-policy-save"
            >
              {saveDnsPolicyMutation.isPending ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div id="soc-section-kpis" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="soc-kpi-cards">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium">{t('soc.kpiOpenCases', 'Open Cases')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold">{kpis?.openCases ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {meaningForDelta(kpis?.deltas?.openCases, 'lower_is_better')} • {formatDeltaCount(kpis?.deltas?.openCases)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium">{t('soc.kpiSlaBreaches', 'SLA Breaches')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold">{kpis?.slaBreaches ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {meaningForDelta(kpis?.deltas?.slaBreaches, 'lower_is_better')} • {formatDeltaCount(kpis?.deltas?.slaBreaches)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium">{t('soc.kpiMttd', 'Avg MTTD')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold">{formatMinutesCompact(kpis?.avgMttdMinutes ?? null)}</div>
            <p className="text-xs text-muted-foreground">
              {meaningForDelta(kpis?.deltas?.avgMttdMinutes, 'lower_is_better')} • {formatDeltaMinutes(kpis?.deltas?.avgMttdMinutes)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium">{t('soc.kpiMttr', 'Avg MTTR')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold">{formatMinutesCompact(kpis?.avgMttrMinutes ?? null)}</div>
            <p className="text-xs text-muted-foreground">
              {meaningForDelta(kpis?.deltas?.avgMttrMinutes, 'lower_is_better')} • {formatDeltaMinutes(kpis?.deltas?.avgMttrMinutes)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card id="soc-section-incidents">
        <CardHeader className="pb-2">
          <CardTitle>
            {t('soc.incidents', 'Incidents')} ({data?.total ?? incidents.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t('soc.loading', 'Loading SOC incidents...')}</p>
          ) : incidents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('soc.empty', 'No incidents found with current filters.')}</p>
          ) : (
            <div className="max-h-[360px] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('threats.timestamp', 'Timestamp')}</TableHead>
                    <TableHead>{t('soc.source', 'Source')}</TableHead>
                    <TableHead>{t('threats.type', 'Type')}</TableHead>
                    <TableHead>{t('threats.severity', 'Severity')}</TableHead>
                    <TableHead>{t('threats.status', 'Status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidents.map((incident, index) => (
                    <TableRow
                      key={incident.id}
                      ref={(el) => {
                        incidentRowRefs.current[index] = el;
                      }}
                      tabIndex={0}
                      role="button"
                      aria-pressed={selected?.id === incident.id}
                      className={`cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        selected?.id === incident.id ? 'bg-accent/40 ring-1 ring-primary/40' : ''
                      }`}
                      onClick={() => setSelected(incident)}
                      onKeyDown={(event) => handleIncidentRowKeyDown(event, index, incident)}
                      data-testid={`soc-incident-${incident.id}`}
                    >
                      <TableCell className="text-xs py-2">{new Date(incident.timestamp).toLocaleString()}</TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline">{incident.sourceType}</Badge>
                      </TableCell>
                      <TableCell className="py-2">{incident.threatType}</TableCell>
                      <TableCell className="py-2">
                        <Badge variant={severityBadgeVariant(incident.severity)}>{incident.severity}</Badge>
                      </TableCell>
                      <TableCell className="py-2">{incident.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card id="soc-section-details" data-testid="soc-incident-details">
          <CardHeader className="pb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle>{t('soc.details', 'Incident Details')}</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => runPlaybook('block')}
                disabled={decisionMutation.isPending}
                data-testid="soc-playbook-contain"
              >
                {t('soc.playbookContain', 'Contain Threat')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => runPlaybook('allow')}
                disabled={decisionMutation.isPending}
                data-testid="soc-playbook-allow"
              >
                {t('soc.playbookAllow', 'Mark Benign')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => runPlaybook('unblock')}
                disabled={decisionMutation.isPending}
                data-testid="soc-playbook-review"
              >
                {t('soc.playbookReview', 'Return to Review')}
              </Button>
              <Button variant="outline" size="sm" onClick={copyEvidence} data-testid="soc-copy-evidence">
                {t('soc.copyEvidence', 'Copy Evidence')}
              </Button>
              <Button variant="outline" size="sm" onClick={copyEvidenceJson} data-testid="soc-copy-evidence-json">
                {t('soc.copyEvidenceJson', 'Copy JSON')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 grid gap-2 md:grid-cols-2">
            <div className="md:col-span-2 border rounded-md p-3 space-y-3">
              <p className="text-xs text-muted-foreground">{t('soc.caseWorkflow', 'Case Workflow')}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="soc-case-owner">{t('soc.caseOwner', 'Case owner')}</Label>
                  <Input
                    id="soc-case-owner"
                    value={caseOwner}
                    onChange={(e) => setCaseOwner(e.target.value)}
                    placeholder={t('soc.caseOwnerPlaceholder', 'analyst@company.com')}
                    data-testid="soc-case-owner"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('soc.caseStatus', 'Case status')}</Label>
                  <Select value={caseStatus} onValueChange={setCaseStatus}>
                    <SelectTrigger data-testid="soc-case-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">{t('soc.caseStatusOpen', 'Open')}</SelectItem>
                      <SelectItem value="in_progress">{t('soc.caseStatusInProgress', 'In Progress')}</SelectItem>
                      <SelectItem value="resolved">{t('soc.caseStatusResolved', 'Resolved')}</SelectItem>
                      <SelectItem value="closed">{t('soc.caseStatusClosed', 'Closed')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="soc-case-sla">{t('soc.slaDueAt', 'SLA due date')}</Label>
                  <Input
                    id="soc-case-sla"
                    type="datetime-local"
                    value={caseSlaDueAt}
                    onChange={(e) => setCaseSlaDueAt(e.target.value)}
                    data-testid="soc-case-sla"
                  />
                  <p className="text-xs text-muted-foreground">{slaTimerText}</p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="soc-case-notes">{t('soc.caseNotes', 'Analyst notes')}</Label>
                  <Textarea
                    id="soc-case-notes"
                    value={caseNotes}
                    onChange={(e) => setCaseNotes(e.target.value)}
                    rows={4}
                    placeholder={t('soc.caseNotesPlaceholder', 'Add investigation notes, findings, and next actions')}
                    data-testid="soc-case-notes"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => saveCaseMutation.mutate()}
                  disabled={saveCaseMutation.isPending || caseLoading || !selected?.id}
                  data-testid="soc-case-save"
                >
                  {saveCaseMutation.isPending ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                </Button>
                {hasEscalationEvent && (
                  <Badge variant="destructive" data-testid="soc-case-escalated-badge">
                    {t('soc.escalated', 'Escalated')}
                  </Badge>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs text-muted-foreground" data-testid="soc-case-timeline-title">
                  {t('soc.timeline.title', 'Case Timeline')}
                </p>
                {caseEventsLoading ? (
                  <p className="text-xs text-muted-foreground">{t('soc.timeline.loading', 'Loading timeline...')}</p>
                ) : caseEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('soc.timeline.empty', 'No timeline events yet.')}</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-auto" data-testid="soc-case-timeline-list">
                    {caseEvents.map((event) => (
                      <div
                        key={event.id}
                        className={event.eventType === 'sla_breached' ? 'rounded border border-destructive/50 bg-destructive/5 p-2' : 'rounded border p-2'}
                      >
                        <p className="text-xs font-medium">{formatCaseEventLabel(event.eventType)}</p>
                        <p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</p>
                        {(event.fromValue || event.toValue) && (
                          <p className="text-xs text-muted-foreground break-words">
                            {event.fromValue || '-'} {'→'} {event.toValue || '-'}
                          </p>
                        )}
                        {event.eventType === 'notes_updated' && (
                          <p className="text-xs text-muted-foreground">
                            {t('soc.timeline.notesLength', 'Notes length updated')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">{t('soc.threatType', 'Threat type')}</p>
              <p className="text-sm">{selected.threatType}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('soc.observedAt', 'Observed at')}</p>
              <p className="text-sm">{new Date(selected.timestamp).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('soc.emailFrom', 'Email from')}</p>
              <p className="text-sm">{selected.emailFrom || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('soc.emailSubject', 'Email subject')}</p>
              <p className="text-sm break-all">{selected.emailSubject || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('soc.downloadName', 'Download name')}</p>
              <p className="text-sm break-all">{selected.downloadName || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('soc.sourceUrl', 'Link / URL')}</p>
              <p className="text-sm break-all">{selected.sourceURL || '-'}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs text-muted-foreground">{t('soc.path', 'Threat location in system')}</p>
              <p className="text-sm break-all">{selected.localPath || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('soc.processName', 'Process')}</p>
              <p className="text-sm break-all">{selected.processName || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('soc.hash', 'Hash')}</p>
              <p className="text-sm break-all">{selected.hash || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('soc.dnsQuery', 'DNS query')}</p>
              <p className="text-sm break-all">{selected.dnsQuery || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('soc.dnsQueryType', 'DNS query type')}</p>
              <p className="text-sm">{selected.dnsQueryType || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('soc.dnsResponseCode', 'DNS response code')}</p>
              <p className="text-sm">{selected.dnsResponseCode || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('soc.dnsResolver', 'DNS resolver')}</p>
              <p className="text-sm break-all">{selected.dnsResolver || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('soc.dnsProtocol', 'DNS protocol')}</p>
              <p className="text-sm">{selected.dnsProtocol || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('soc.dnsEncrypted', 'Encrypted DNS')}</p>
              <p className="text-sm">{selected.dnsEncrypted === null || selected.dnsEncrypted === undefined ? '-' : (selected.dnsEncrypted ? 'Yes' : 'No')}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs text-muted-foreground">{t('soc.description', 'Description')}</p>
              <p className="text-sm break-words">{selected.description || '-'}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
