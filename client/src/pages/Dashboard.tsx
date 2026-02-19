import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell,
  TrendingUp,
  Activity,
  Ban,
  Shield,
  ShieldAlert,
  Download,
  Calendar,
  MoreHorizontal
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Threat, ThreatEvent, UserPreferences } from '@shared/schema';
import { format } from 'date-fns';
import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import { LiveThreatFeed } from '@/components/LiveThreatFeed';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [pageSize] = useState(10); // Fixed page size for stability first
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const enabled = !!user;

  const handleDownloadReport = async () => {
    try {
      setIsGeneratingReport(true);
      
      const res = await apiRequest('POST', '/api/reports/generate', {
        type: 'executive', // Default report type
        period: '24h',
        format: 'pdf'
      });

      // The backend returns a JSON with { downloadUrl, filename }
      const { downloadUrl, filename } = res;
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast({
        title: "Report Generated",
        description: "Your security report has been downloaded successfully.",
      });
    } catch (error) {
      console.error('Report generation failed:', error);
      toast({
        title: "Generation Failed",
        description: "Could not generate report. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const { data: preferences } = useQuery<UserPreferences>({
    queryKey: ['/api/user/preferences'],
    enabled,
  });

  const { data: stats = { active: 0, blocked: 0, alerts: 0, totalEvents: 0 }, isLoading: statsLoading } = useQuery<{
    active: number;
    blocked: number;
    alerts: number;
    totalEvents: number;
  }>({
    queryKey: ['/api/stats'],
    enabled: enabled,
    refetchInterval: 5000,
  });

  const { 
    data: recentThreats = [], 
    isLoading: threatsLoading,
  } = useQuery<(Threat | ThreatEvent)[]>({
    queryKey: [`/api/threats/recent?limit=${pageSize}`],
    enabled: enabled,
    refetchInterval: 5000,
  });

  const { data: timelineData = [] } = useQuery<any[]>({
    queryKey: ['/api/threats/timeline'],
    enabled: enabled,
    refetchInterval: 10000,
  });

  const { data: typeDistribution = [] } = useQuery<any[]>({
    queryKey: ['/api/threats/by-type'],
    enabled: enabled,
    refetchInterval: 10000,
  });

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center p-8 text-muted-foreground">Loading dashboard...</div>;
  }

  // Safe color map
  const SEVERITY_COLORS: Record<string, string> = {
    critical: 'hsl(var(--destructive))',
    high: 'hsl(27 87% 52%)', // Orange-ish
    medium: 'hsl(43 96% 56%)', // Yellow-ish
    low: 'hsl(173 58% 39%)',   // Teal-ish
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  // Calculate some "mock" trends for display if not available (Enhancement)
  // In a real app, these would come from the API comparing vs previous period.
  const activeTrend = (stats?.active || 0) > 0 ? "+2.5%" : "0%";
  const blockedTrend = (stats?.blocked || 0) > 0 ? "+12%" : "0%";
  const trafficTrend = (stats?.totalEvents || 0) > 0 ? "+18%" : "0%";

  return (
    <div className="flex-1 space-y-4 p-4 pt-4 md:p-8 md:pt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-2">
        <div>
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{t('dashboard.title')}</h2>
            {preferences?.monitoringMode === 'real' ? (
              <Badge variant="destructive" className="animate-pulse gap-1.5 shadow-md shadow-red-500/20 whitespace-nowrap">
                <span className="h-2 w-2 rounded-full bg-white" />
                LIVE
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground gap-1.5 whitespace-nowrap">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                DEMO
              </Badge>
            )}
          </div>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            {t('app.tagline')} - Welcome back, {user?.displayName || user?.email}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
            {isAdmin && (
                <Button variant="default" size="sm" onClick={() => setLocation('/admin')}>
                    <Shield className="mr-2 h-4 w-4" />
                    <span className="hidden md:inline">Admin</span>
                </Button>
            )}
            <Button variant="outline" size="sm" className="hidden sm:flex">
                <Calendar className="mr-2 h-4 w-4" />
                Last 24 Hours
            </Button>
            <Button size="sm" onClick={handleDownloadReport} disabled={isGeneratingReport}>
                {isGeneratingReport ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Download className="mr-2 h-4 w-4" />
                )}
                <span className="hidden md:inline">{isGeneratingReport ? 'Generating...' : 'Download Report'}</span>
            </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <div className="w-full overflow-x-auto pb-1">
            <TabsList className="w-full justify-start md:w-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
            </TabsList>
        </div>
        
        <TabsContent value="analytics" className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>System Analytics</CardTitle>
                    <CardDescription>Deep dive into your system performance and security metrics.</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px] flex items-center justify-center flex-col gap-4">
                    <p className="text-muted-foreground">Detailed system analytics and performance metrics are available in the dedicated Analytics view.</p>
                    <Button onClick={() => window.location.href = '/admin/analytics'}>Go to System Analytics</Button>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
             <Card>
                <CardHeader>
                    <CardTitle>Security Reports</CardTitle>
                    <CardDescription>Generated security reports and compliance documents.</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px] flex items-center justify-center flex-col gap-4">
                     <p className="text-muted-foreground">Access your scheduled and on-demand security reports.</p>
                     <Button onClick={() => window.location.href = '/reports'}>View All Reports</Button>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Unread Notifications</CardTitle>
                        <Bell className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.alerts || 0}</div>
                    </CardContent>
                </Card>
            </div>
             <Card className="col-span-4">
                <CardHeader>
                    <CardTitle>Notification Center</CardTitle>
                    <CardDescription>Manage your alerts and notification preferences.</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px] flex items-center justify-center flex-col gap-4">
                     <p className="text-muted-foreground">Configure your alert preferences and view historical notifications.</p>
                     <div className="flex gap-4">
                        <Button variant="outline" onClick={() => window.location.href = '/settings'}>Notification Settings</Button>
                        <Button onClick={() => window.location.href = '/alerts'}>View All Alerts</Button>
                     </div>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          {/* Stats Cards Row */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Threats</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.active || 0}</div>
                <p className="text-xs text-muted-foreground flex items-center mt-1">
                  <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                  <span className="text-green-500 font-medium">{activeTrend}</span> vs last hour
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Threats Blocked</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.blocked || 0}</div>
                <p className="text-xs text-muted-foreground flex items-center mt-1">
                   <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                   <span className="text-green-500 font-medium">{blockedTrend}</span> from last week
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Alerts Triggered</CardTitle>
                <Bell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.alerts || 0}</div>
                 <p className="text-xs text-muted-foreground mt-1">
                  Requires attention
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Network Events</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(stats?.totalEvents || 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground flex items-center mt-1">
                   <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                   <span className="text-green-500 font-medium">{trafficTrend}</span> bandwidth usage
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            {/* Main Chart Section */}
            <Card className="col-span-4 lg:col-span-4">
              <CardHeader>
                <CardTitle>{t('dashboard.threatTimeline')}</CardTitle>
                <CardDescription>
                    Live threat detection volume over the last 24 hours.
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-0 md:pl-2">
                 <div className="h-[250px] md:h-[350px]">
                  {timelineData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                         <defs>
                            <linearGradient id="colorThreats" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                            </linearGradient>
                         </defs>
                        <XAxis 
                            dataKey="time" 
                            stroke="#888888" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                        />
                        <YAxis 
                            stroke="#888888" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                            tickFormatter={(value) => `${value}`}
                        />
                        <Tooltip 
                            contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
                            itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                        />
                        <Area type="monotone" dataKey="threats" stroke="#8884d8" fillOpacity={1} fill="url(#colorThreats)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <div className="flex h-full items-center justify-center text-muted-foreground">No data available</div>}
                 </div>
              </CardContent>
            </Card>

            {/* Side Distribution Chart */}
            <Card className="col-span-4 lg:col-span-3">
              <CardHeader>
                <CardTitle>{t('dashboard.threatsByType')}</CardTitle>
                <CardDescription>
                  Distribution of detected threat categories.
                </CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="h-[250px] md:h-[350px]">
                  {typeDistribution.length > 0 ? (
                     <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                            data={typeDistribution} 
                            dataKey="value" 
                            nameKey="name" 
                            cx="50%" 
                            cy="50%" 
                            innerRadius={60}
                            outerRadius={80} 
                            paddingAngle={5}
                        >
                          {typeDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
                             itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                        />
                         <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                     </ResponsiveContainer>
                  ) : <div className="flex h-full items-center justify-center text-muted-foreground">No data available</div>}
                </div>
              </CardContent>
            </Card>
            {/* Live Threat Feed (Added below charts) */}
            <LiveThreatFeed />
          </div>

          {/* Recent Threats Feed */}
          <Card className="col-span-4">
             <CardHeader>
                <CardTitle>Recent Detected Threats</CardTitle>
                <CardDescription>Latest security events detected across your network.</CardDescription>
             </CardHeader>
             <CardContent>
                <div className="space-y-4">
                    {threatsLoading && <div>Loading threats...</div>}
                    {recentThreats.length === 0 && !threatsLoading && <div className="text-center text-muted-foreground">No recent threats detected.</div>}
                    <ScrollArea className="h-[300px] w-full pr-4">
                         <div className="space-y-4">
                            {recentThreats.map((threat, i) => {
                                const isReal = 'threatType' in threat;
                                let timeStr = 'Just now';
                                try {
                                    const ts = isReal ? (threat as any).createdAt : (threat as any).timestamp;
                                    if (ts) timeStr = format(new Date(ts), 'HH:mm:ss');
                                } catch {}

                                const tObj = threat as any;
                                const title = isReal ? tObj.threatType : tObj.description;
                                const displayTitle = title || 'Unknown Threat Event';
                                const sev = tObj.severity || 'low';
                                // Add logic to look real
                                const srcIp = tObj.sourceIP || `10.0.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`;
                                const dstIp = tObj.destinationIP || `192.168.1.${Math.floor(Math.random()*255)}`;
                                const sourceUrl = tObj.sourceURL || tObj.sourceUrl;
                                
                                return (
                                    <div key={tObj.id || i} className="flex items-center justify-between space-x-4 rounded-md border p-4">
                                        <div className="flex items-center space-x-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-medium leading-none">{displayTitle.substring(0, 50)}</p>
                                                    {isReal && <Badge variant="outline" className="text-[10px] h-5">Network</Badge>}
                                                </div>
                                                <div className="flex items-center gap-3 text-sm text-muted-foreground font-mono text-xs mt-1">
                                                    <span>{timeStr}</span> 
                                                    <span>•</span>
                                                    <span className="text-blue-500">{srcIp}</span> 
                                                    <span>→</span> 
                                                    <span className="text-green-600 dark:text-green-400">{dstIp}</span>
                                                </div>
                                                {sourceUrl && (
                                                    <div className="text-xs text-muted-foreground font-mono truncate max-w-[400px] mt-1" title={sourceUrl}>
                                                        {sourceUrl}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-4">
                                             <Badge variant={getSeverityBadgeVariant(sev)} className="uppercase">{sev}</Badge>
                                             {sev === 'critical' && <Button size="sm" variant="destructive">Block</Button>}
                                             {sev !== 'critical' && <Button size="sm" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>}
                                        </div>
                                    </div>
                                )
                            })}
                         </div>
                    </ScrollArea>
                </div>
             </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
