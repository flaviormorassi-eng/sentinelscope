import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Activity, TrendingUp, Globe, PlusCircle, Trash2, Loader2 } from 'lucide-react';
import { Threat, User, IpBlocklistEntry } from '@shared/schema';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest, queryClient } from '@/lib/queryClient';

const SEVERITY_COLORS = {
  critical: 'hsl(var(--destructive))',
  high: 'hsl(27 87% 52%)',
  medium: 'hsl(43 96% 56%)',
  low: 'hsl(173 58% 39%)',
};

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export default function SystemAnalytics() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [limitFilter, setLimitFilter] = useState('100');

  const [isAddIpDialogOpen, setIsAddIpDialogOpen] = useState(false);
  const [newIpAddress, setNewIpAddress] = useState('');
  const [newIpReason, setNewIpReason] = useState('');
  const { data: currentUser, isLoading: userLoading } = useQuery<User>({
    queryKey: [`/api/user/${user?.uid}`],
    enabled: !!user?.uid,
  });

  useEffect(() => {
    if (!userLoading && currentUser && !currentUser.isAdmin) {
      setLocation('/');
    }
  }, [userLoading, currentUser, setLocation]);

  const { data: threats = [], isLoading } = useQuery<Threat[]>({
    queryKey: [`/api/admin/threats?limit=${limitFilter}`],
    enabled: currentUser?.isAdmin === true,
  });

  const { data: ipBlocklist = [], isLoading: blocklistLoading } = useQuery<IpBlocklistEntry[]>({
    queryKey: ['/api/admin/ip-blocklist'],
    enabled: currentUser?.isAdmin === true,
  });

  const addIpMutation = useMutation({
    mutationFn: async (data: { ipAddress: string; reason?: string }) => {
      return apiRequest('POST', '/api/admin/ip-blocklist', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ip-blocklist'] });
      setIsAddIpDialogOpen(false);
      setNewIpAddress('');
      setNewIpReason('');
    },
    onError: (error: any) => {
      // You would typically use a toast notification here
      console.error("Failed to add IP to blocklist:", error.message);
    },
  });

  const removeIpMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/admin/ip-blocklist/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ip-blocklist'] });
    },
  });

  const handleAddIp = () => {

    if (newIpAddress) {
      addIpMutation.mutate({ ipAddress: newIpAddress, reason: newIpReason });
    }
  }

  if (userLoading || !currentUser) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-9 w-64 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
          <Skeleton className="h-12 w-[180px]" />
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
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[300px] w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
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

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  // Calculate statistics
  const threatsByType = threats.reduce((acc, threat) => {
    acc[threat.type] = (acc[threat.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const threatTypesData = Object.entries(threatsByType).map(([name, value]) => ({
    name,
    value,
  }));

  const threatsBySeverity = threats.reduce((acc, threat) => {
    acc[threat.severity] = (acc[threat.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const severityData = Object.entries(threatsBySeverity).map(([name, value]) => ({
    name,
    value,
  }));

  const threatsByCountry = threats.reduce((acc, threat) => {
    if (threat.sourceCountry) {
      acc[threat.sourceCountry] = (acc[threat.sourceCountry] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const countryData = Object.entries(threatsByCountry)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }));

  const statCards = [
    {
      title: 'admin.totalThreatsAnalyzed',
      value: threats.length,
      icon: Activity,
      color: 'text-chart-1',
      bgColor: 'bg-chart-1/10',
      testId: 'stat-total-analyzed'
    },
    {
      title: 'admin.uniqueCountries',
      value: Object.keys(threatsByCountry).length,
      icon: Globe,
      color: 'text-chart-3',
      bgColor: 'bg-chart-3/10',
      testId: 'stat-unique-countries'
    },
    {
      title: 'admin.criticalThreats',
      value: threatsBySeverity.critical || 0,
      icon: TrendingUp,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      testId: 'stat-critical-threats'
    },
    {
      title: 'admin.threatTypes',
      value: Object.keys(threatsByType).length,
      icon: Activity,
      color: 'text-chart-2',
      bgColor: 'bg-chart-2/10',
      testId: 'stat-threat-types'
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('admin.systemAnalytics')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('admin.threatAnalytics')}
          </p>
        </div>
        
        <Select value={limitFilter} onValueChange={setLimitFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-limit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50">Last 50 threats</SelectItem>
            <SelectItem value="100">Last 100 threats</SelectItem>
            <SelectItem value="500">Last 500 threats</SelectItem>
            <SelectItem value="1000">Last 1000 threats</SelectItem>
          </SelectContent>
        </Select>
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
              {isLoading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                <div className="text-3xl font-bold">{stat.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.threatsByType')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : threatTypesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={threatTypesData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {threatTypesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
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
                {t('admin.noData')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('admin.threatsBySeverity')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : severityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={severityData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {severityData.map((entry) => (
                      <Cell 
                        key={`cell-${entry.name}`} 
                        fill={SEVERITY_COLORS[entry.name as keyof typeof SEVERITY_COLORS]} 
                      />
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
                {t('admin.noData')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.topCountries')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : countryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={countryData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="name" 
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
                <Bar dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              {t('admin.noData')}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.recentThreats')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
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
                    <TableHead className="w-[180px]">{t('threats.timestamp')}</TableHead>
                    <TableHead className="w-[100px]">{t('threats.severity')}</TableHead>
                    <TableHead>{t('threats.type')}</TableHead>
                    <TableHead className="w-[140px]">{t('threats.source')}</TableHead>
                    <TableHead className="w-[120px]">{t('admin.country')}</TableHead>
                    <TableHead>{t('threats.description')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {threats.length > 0 ? (
                    threats.slice(0, 20).map((threat) => (
                      <TableRow key={threat.id} data-testid={`row-threat-${threat.id}`}>
                        <TableCell className="font-mono text-xs">
                          {format(new Date(threat.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getSeverityBadgeVariant(threat.severity)}>
                            {threat.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{threat.type}</TableCell>
                        <TableCell className="font-mono text-xs">{threat.sourceIP}</TableCell>
                        <TableCell className="text-xs">{threat.sourceCountry || '-'}</TableCell>
                        <TableCell className="text-sm">{threat.description}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {t('admin.noThreats')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>IP Blocklist Management</CardTitle>
          <Button size="sm" onClick={() => setIsAddIpDialogOpen(true)}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add IP
          </Button>
        </CardHeader>
        <CardContent>
          {blocklistLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Added By</TableHead>
                    <TableHead>Added At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ipBlocklist.length > 0 ? (
                    ipBlocklist.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-mono">{entry.ipAddress}</TableCell>
                        <TableCell>{entry.reason || '-'}</TableCell>
                        <TableCell className="text-xs">{entry.addedBy?.slice(0, 8)}...</TableCell>
                        <TableCell className="text-xs">{format(new Date(entry.createdAt), 'yyyy-MM-dd HH:mm')}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeIpMutation.mutate(entry.id)}
                            disabled={removeIpMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No IPs on the blocklist.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddIpDialogOpen} onOpenChange={setIsAddIpDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add IP to Blocklist</DialogTitle>
            <DialogDescription>
              This IP will be flagged as a high-severity threat if detected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ip-address">IP Address</Label>
              <Input id="ip-address" value={newIpAddress} onChange={(e) => setNewIpAddress(e.target.value)} placeholder="e.g., 103.27.108.83" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input id="reason" value={newIpReason} onChange={(e) => setNewIpReason(e.target.value)} placeholder="e.g., Known C2 Server" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddIpDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddIp} disabled={addIpMutation.isPending}>
              {addIpMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add to Blocklist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
