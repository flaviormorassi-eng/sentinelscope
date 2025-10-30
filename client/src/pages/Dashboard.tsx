import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  AlertTriangle, 
  ShieldCheck, 
  Bell,
  TrendingUp,
  Activity
} from 'lucide-react';
import { Threat, Alert } from '@shared/schema';
import { format } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const SEVERITY_COLORS = {
  critical: 'hsl(var(--destructive))',
  high: 'hsl(27 87% 52%)',
  medium: 'hsl(43 96% 56%)',
  low: 'hsl(173 58% 39%)',
};

export default function Dashboard() {
  const { t } = useTranslation();

  const { data: stats = { active: 0, blocked: 0, alerts: 0 }, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/stats'],
  });

  const { data: threats = [], isLoading: threatsLoading } = useQuery<Threat[]>({
    queryKey: ['/api/threats/recent'],
  });

  const { data: alerts = [], isLoading: alertsLoading } = useQuery<Alert[]>({
    queryKey: ['/api/alerts/recent'],
  });

  const { data: chartData = [] } = useQuery({
    queryKey: ['/api/threats/timeline'],
  });

  const { data: typeDistribution = [] } = useQuery({
    queryKey: ['/api/threats/by-type'],
  });

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const statCards = [
    {
      title: t('dashboard.activeThreats'),
      value: stats.active || 0,
      icon: AlertTriangle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      testId: 'stat-active-threats'
    },
    {
      title: t('dashboard.threatsBlocked'),
      value: stats.blocked || 0,
      icon: ShieldCheck,
      color: 'text-chart-3',
      bgColor: 'bg-chart-3/10',
      testId: 'stat-threats-blocked'
    },
    {
      title: t('dashboard.alertsToday'),
      value: stats.alerts || 0,
      icon: Bell,
      color: 'text-chart-4',
      bgColor: 'bg-chart-4/10',
      testId: 'stat-alerts-today'
    },
    {
      title: t('dashboard.systemStatus'),
      value: t('dashboard.allSystemsOperational'),
      icon: Shield,
      color: 'text-chart-3',
      bgColor: 'bg-chart-3/10',
      isText: true,
      testId: 'stat-system-status'
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('app.tagline')}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} data-testid={stat.testId}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={`h-8 w-8 rounded-md ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`${stat.isText ? 'text-xl' : 'text-3xl'} font-bold`}>
                {stat.value}
              </div>
              {!stat.isText && (
                <p className="text-xs text-muted-foreground mt-2">
                  <TrendingUp className="inline h-3 w-3 mr-1" />
                  Real-time monitoring
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {t('dashboard.threatTimeline')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="time" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="threats" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary) / 0.2)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                {statsLoading ? t('common.loading') : t('dashboard.noThreats')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.threatsByType')}</CardTitle>
          </CardHeader>
          <CardContent>
            {typeDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={typeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {typeDistribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                {statsLoading ? t('common.loading') : t('dashboard.noThreats')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-destructive" />
              {t('dashboard.threatFeed')}
              <Badge variant="destructive" className="ml-auto">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse mr-1.5" />
                Live
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {threatsLoading ? (
                <p className="text-muted-foreground text-center py-8">{t('common.loading')}</p>
              ) : threats.length > 0 ? (
                threats.slice(0, 10).map((threat) => (
                  <div
                    key={threat.id}
                    className="flex items-start gap-3 p-3 rounded-lg border hover-elevate"
                    data-testid={`threat-${threat.id}`}
                  >
                    <div className={`h-2 w-2 rounded-full mt-2 ${
                      threat.severity === 'critical' ? 'bg-destructive' :
                      threat.severity === 'high' ? 'bg-chart-5' :
                      threat.severity === 'medium' ? 'bg-chart-4' : 'bg-chart-3'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={getSeverityBadgeVariant(threat.severity)} className="text-xs">
                          {t(`threats.severityLevels.${threat.severity}`)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(threat.timestamp), 'HH:mm:ss')}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{threat.description}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-1">
                        {threat.sourceIP} → {threat.targetIP}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">{t('dashboard.noThreats')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t('dashboard.recentAlerts')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {alertsLoading ? (
                <p className="text-muted-foreground text-center py-8">{t('common.loading')}</p>
              ) : alerts.length > 0 ? (
                alerts.slice(0, 10).map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border ${alert.read ? 'opacity-60' : ''} hover-elevate`}
                    data-testid={`alert-${alert.id}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-medium">{alert.title}</p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(alert.timestamp), 'HH:mm')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{alert.message}</p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">{t('alerts.noAlerts')}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
