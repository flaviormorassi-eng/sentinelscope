import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { 
  Users, 
  Shield, 
  Bell,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { User, AdminAuditLog, Threat } from '@shared/schema';
import { format } from 'date-fns';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface AdminStats {
  totalUsers: number;
  totalThreats: number;
  totalAlerts: number;
  estimatedRevenue: number;
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [reviewThreat, setReviewThreat] = useState<Threat | null>(null);
  const [reason, setReason] = useState('');

  const { data: currentUser, isLoading: userLoading } = useQuery<User>({
    queryKey: [`/api/user/${user?.uid}`],
    enabled: !!user?.uid,
  });

  useEffect(() => {
    if (!userLoading && currentUser && !currentUser.isAdmin) {
      setLocation('/');
    }
  }, [userLoading, currentUser, setLocation]);

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ['/api/admin/stats'],
    enabled: currentUser?.isAdmin === true,
  });

  const { data: auditLogs = [], isLoading: logsLoading } = useQuery<AdminAuditLog[]>({
    queryKey: ['/api/admin/audit-logs'],
    enabled: currentUser?.isAdmin === true,
  });

  const { data: pendingThreats = [], isLoading: pendingLoading } = useQuery<Threat[]>({
    queryKey: ['/api/admin/threats/pending'],
    enabled: currentUser?.isAdmin === true,
  });

  const decisionMutation = useMutation({
    mutationFn: async ({ threatId, decision, reason }: { threatId: string; decision: 'block' | 'allow'; reason?: string }) => {
      return await apiRequest(`/api/admin/threats/${threatId}/decide`, {
        method: 'POST',
        body: JSON.stringify({ decision, reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/threats/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/threats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/audit-logs'] });
      setReviewThreat(null);
      setReason('');
      toast({
        title: t('admin.decisionRecorded'),
        description: t('admin.threatDecisionSuccess'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('admin.threatDecisionError'),
        variant: 'destructive',
      });
    },
  });

  if (userLoading || !currentUser) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentUser.isAdmin) {
    return null;
  }

  const statCards = [
    {
      title: 'admin.totalUsers',
      value: stats?.totalUsers || 0,
      icon: Users,
      color: 'text-chart-1',
      bgColor: 'bg-chart-1/10',
      testId: 'stat-total-users'
    },
    {
      title: 'admin.totalThreats',
      value: stats?.totalThreats || 0,
      icon: Shield,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      testId: 'stat-total-threats'
    },
    {
      title: 'admin.pendingThreats',
      value: pendingThreats.length || 0,
      icon: AlertTriangle,
      color: 'text-chart-5',
      bgColor: 'bg-chart-5/10',
      testId: 'stat-pending-threats'
    },
    {
      title: 'admin.totalAlerts',
      value: stats?.totalAlerts || 0,
      icon: Bell,
      color: 'text-chart-4',
      bgColor: 'bg-chart-4/10',
      testId: 'stat-total-alerts'
    },
    {
      title: 'admin.estimatedRevenue',
      value: `$${((stats?.estimatedRevenue || 0) / 100).toFixed(2)}`,
      icon: DollarSign,
      color: 'text-chart-3',
      bgColor: 'bg-chart-3/10',
      testId: 'stat-estimated-revenue',
      isText: true
    },
  ];

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
      critical: 'destructive',
      high: 'destructive',
      medium: 'secondary',
      low: 'outline',
    };
    return variants[severity] || 'default';
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('admin.dashboard')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('admin.systemOverview')}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat) => (
          <Card key={stat.title} data-testid={stat.testId}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t(stat.title)}
              </CardTitle>
              <div className={`h-8 w-8 rounded-md ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {(statsLoading || pendingLoading) ? (
                <Skeleton className="h-9 w-24" />
              ) : (
                <div className={`${stat.isText ? 'text-xl' : 'text-3xl'} font-bold`}>
                  {stat.value}
                </div>
              )}
              {!stat.isText && (
                <p className="text-xs text-muted-foreground mt-2">
                  <TrendingUp className="inline h-3 w-3 mr-1" />
                  System-wide metrics
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {pendingThreats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-chart-5" />
              {t('admin.pendingThreatsReview')} ({pendingThreats.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">{t('threats.timestamp')}</TableHead>
                      <TableHead>{t('threats.type')}</TableHead>
                      <TableHead className="w-[120px]">{t('threats.severity')}</TableHead>
                      <TableHead className="w-[150px]">{t('threats.sourceIP')}</TableHead>
                      <TableHead>{t('threats.description')}</TableHead>
                      <TableHead className="w-[200px] text-right">{t('admin.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingThreats.slice(0, 10).map((threat) => (
                      <TableRow key={threat.id} data-testid={`pending-threat-${threat.id}`}>
                        <TableCell className="font-mono text-xs">
                          {format(new Date(threat.timestamp), 'yyyy-MM-dd HH:mm')}
                        </TableCell>
                        <TableCell>{threat.type}</TableCell>
                        <TableCell>
                          <Badge variant={getSeverityBadge(threat.severity)}>
                            {threat.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{threat.sourceIP}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {threat.description}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setReviewThreat(threat)}
                              data-testid={`button-review-threat-${threat.id}`}
                            >
                              <Shield className="h-3 w-3 mr-1" />
                              {t('admin.review')}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.recentAuditLogs')}</CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">{t('admin.timestamp')}</TableHead>
                    <TableHead className="w-[120px]">{t('admin.admin')}</TableHead>
                    <TableHead>{t('admin.action')}</TableHead>
                    <TableHead className="w-[120px]">{t('admin.targetUser')}</TableHead>
                    <TableHead>{t('admin.details')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.length > 0 ? (
                    auditLogs.slice(0, 10).map((log) => (
                      <TableRow key={log.id} data-testid={`audit-log-${log.id}`}>
                        <TableCell className="font-mono text-xs">
                          {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                        </TableCell>
                        <TableCell className="text-xs">{log.adminId.slice(0, 8)}...</TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.action}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {log.targetUserId ? `${log.targetUserId.slice(0, 8)}...` : '-'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.details || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {t('admin.noAuditLogs')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!reviewThreat} onOpenChange={(open) => !open && setReviewThreat(null)}>
        <DialogContent data-testid="dialog-threat-review">
          <DialogHeader>
            <DialogTitle>{t('admin.reviewThreat')}</DialogTitle>
            <DialogDescription>
              {t('admin.reviewThreatDescription')}
            </DialogDescription>
          </DialogHeader>
          
          {reviewThreat && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">{t('threats.type')}:</span>
                  <p className="text-muted-foreground">{reviewThreat.type}</p>
                </div>
                <div>
                  <span className="font-medium">{t('threats.severity')}:</span>
                  <Badge variant={getSeverityBadge(reviewThreat.severity)} className="ml-2">
                    {reviewThreat.severity}
                  </Badge>
                </div>
                <div>
                  <span className="font-medium">{t('threats.sourceIP')}:</span>
                  <p className="text-muted-foreground font-mono">{reviewThreat.sourceIP}</p>
                </div>
                <div>
                  <span className="font-medium">{t('threats.sourceCountry')}:</span>
                  <p className="text-muted-foreground">{reviewThreat.sourceCountry || '-'}</p>
                </div>
              </div>
              
              <div>
                <span className="font-medium text-sm">{t('threats.description')}:</span>
                <p className="text-muted-foreground text-sm mt-1">{reviewThreat.description}</p>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="reason" className="text-sm font-medium">
                  {t('admin.decisionReason')} ({t('common.optional')})
                </label>
                <Textarea
                  id="reason"
                  placeholder={t('admin.decisionReasonPlaceholder')}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  data-testid="textarea-decision-reason"
                />
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setReviewThreat(null);
                setReason('');
              }}
              disabled={decisionMutation.isPending}
              data-testid="button-cancel-review"
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (reviewThreat) {
                  decisionMutation.mutate({
                    threatId: reviewThreat.id,
                    decision: 'allow',
                    reason: reason || undefined,
                  });
                }
              }}
              disabled={decisionMutation.isPending}
              data-testid="button-allow-threat"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {t('admin.allowThreat')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (reviewThreat) {
                  decisionMutation.mutate({
                    threatId: reviewThreat.id,
                    decision: 'block',
                    reason: reason || undefined,
                  });
                }
              }}
              disabled={decisionMutation.isPending}
              data-testid="button-block-threat"
            >
              <XCircle className="h-4 w-4 mr-2" />
              {t('admin.blockThreat')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
