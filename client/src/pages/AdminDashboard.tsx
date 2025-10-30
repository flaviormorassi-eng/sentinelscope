import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  Shield, 
  Bell,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { User, AdminAuditLog } from '@shared/schema';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';

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

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('admin.dashboard')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('admin.systemOverview')}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              {statsLoading ? (
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
    </div>
  );
}
