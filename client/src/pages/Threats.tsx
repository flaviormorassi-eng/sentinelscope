import { useState } from 'react';
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
import { Download, Search, Filter, Unlock, History, ExternalLink, Monitor, Mail, Usb, Globe, Network } from 'lucide-react';
import { Threat, User } from '@shared/schema';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface ThreatDecision {
  id: number;
  threatId: string;
  adminId: string;
  decision: string;
  reason: string | null;
  timestamp: string;
}

export default function Threats() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [historyThreatId, setHistoryThreatId] = useState<string | null>(null);

  const { data: currentUser } = useQuery<User>({
    queryKey: [`/api/user/${user?.uid}`],
    enabled: !!user?.uid,
  });

  const { data: threats = [], isLoading } = useQuery<Threat[]>({
    queryKey: ['/api/threats'],
  });

  const { data: decisionHistory = [], isLoading: historyLoading } = useQuery<ThreatDecision[]>({
    queryKey: [`/api/admin/threats/${historyThreatId}/history`],
    enabled: !!historyThreatId && !!currentUser?.isAdmin,
  });

  const unblockMutation = useMutation({
    mutationFn: async (threatId: string) => {
      return await apiRequest('POST', `/api/admin/threats/${threatId}/decide`, {
        decision: 'unblock',
        reason: 'Unblocked from threat log view',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/threats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/threats/pending'] });
      toast({
        title: t('admin.decisionRecorded'),
        description: t('threats.threatUnblocked'),
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('admin.threatDecisionError'),
        variant: 'destructive',
      });
    },
  });

  const filteredThreats = threats.filter((threat) => {
    const matchesSearch = 
      threat.sourceIP.toLowerCase().includes(search.toLowerCase()) ||
      threat.description.toLowerCase().includes(search.toLowerCase()) ||
      threat.type.toLowerCase().includes(search.toLowerCase()) ||
      (threat.deviceName && threat.deviceName.toLowerCase().includes(search.toLowerCase())) ||
      (threat.sourceURL && threat.sourceURL.toLowerCase().includes(search.toLowerCase())) ||
      (threat.threatVector && threat.threatVector.toLowerCase().includes(search.toLowerCase()));
    
    const matchesSeverity = severityFilter === 'all' || threat.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || threat.status === statusFilter;

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

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('threats.title')}</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('threats.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-threats"
              />
            </div>
            <div className="flex gap-2">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
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

              <Select value={statusFilter} onValueChange={setStatusFilter}>
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
                  {currentUser?.isAdmin && <TableHead className="w-[100px] text-right">{t('admin.actions')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={currentUser?.isAdmin ? 11 : 10} className="text-center py-8 text-muted-foreground">
                      {t('common.loading')}
                    </TableCell>
                  </TableRow>
                ) : filteredThreats.length > 0 ? (
                  filteredThreats.map((threat) => (
                    <TableRow key={threat.id} data-testid={`row-threat-${threat.id}`}>
                      <TableCell className="font-mono text-xs">
                        {format(new Date(threat.timestamp), 'yyyy-MM-dd HH:mm:ss')}
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
                      {currentUser?.isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            {threat.status !== 'detected' && threat.status !== 'pending_review' && (
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
                            {threat.status === 'blocked' && (
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
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={currentUser?.isAdmin ? 11 : 10} className="text-center py-8 text-muted-foreground">
                      {t('threats.noThreats')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
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
