import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Bot, User as UserIcon, ShieldAlert, Cpu } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface BotStats {
  total: number;
  bots: number;
  humans: number;
  botTypes: Array<{ browser: string; count: number }>;
}

export function BotTrafficChart() {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useQuery<BotStats>({
    queryKey: ['/api/network/bot-stats'],
    refetchInterval: 15000,
  });

  const data = [
    { name: t('networkActivity.legitimateTraffic', 'Legitimate Traffic'), value: stats?.humans || 0, color: 'hsl(var(--chart-2))' },
    { name: t('networkActivity.botTraffic', 'Automated/Bot Traffic'), value: stats?.bots || 0, color: 'hsl(var(--destructive))' },
  ];

  const total = (stats?.humans || 0) + (stats?.bots || 0);
  const botPercentage = total > 0 ? Math.round(((stats?.bots || 0) / total) * 100) : 0;

  return (
    <Card className="h-full bg-card border-border shadow-xl overflow-hidden relative group">
      {/* Background Matrix Effect (Subtle) */}
      <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--background)/0)_50%,hsl(var(--foreground)/0.05)_50%),linear-gradient(90deg,hsl(var(--foreground)/0.06),hsl(var(--primary)/0.03),hsl(var(--foreground)/0.06))] z-[5] pointer-events-none bg-[length:100%_4px,3px_100%] opacity-20" />

      <CardHeader className="border-b border-border bg-muted/30 relative z-10 py-3">
        <CardTitle className="text-sm font-medium font-mono flex items-center gap-2 text-primary">
          <Cpu className="h-4 w-4" />
          {t('networkActivity.trafficAnalyzer', 'Traffic Analyzer')} // {t('networkActivity.classification', 'Classification')}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 relative z-10 flex flex-col md:flex-row gap-6 items-center justify-center h-[calc(100%-50px)]">
        {/* Left Side: Donut Chart */}
        <div className="w-48 h-48 relative shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '4px', color: 'hsl(var(--card-foreground))' }}
                itemStyle={{ color: 'hsl(var(--card-foreground))' }}
              />
            </PieChart>
          </ResponsiveContainer>
          
          {/* Centered Percentage */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className={`text-3xl font-bold ${botPercentage > 30 ? 'text-destructive' : 'text-foreground'}`}>
              {botPercentage}%
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{t('networkActivity.botLoad', 'Bot Load')}</span>
          </div>
        </div>

        {/* Right Side: Stats & Breakdown */}
        <div className="flex-1 w-full space-y-4">
            {/* Top Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/30 p-3 rounded border border-border flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-full">
                  <UserIcon className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">{t('networkActivity.humans', 'Humans')}</div>
                  <div className="text-lg font-bold text-foreground font-mono">{(stats?.humans || 0).toLocaleString()}</div>
                    </div>
                </div>
              <div className={`bg-muted/30 p-3 rounded border border-border flex items-center gap-3 ${botPercentage > 50 ? 'animate-pulse border-destructive/40' : ''}`}>
                <div className="p-2 bg-destructive/10 rounded-full">
                  <Bot className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">{t('networkActivity.bots', 'Bots')}</div>
                  <div className="text-lg font-bold text-foreground font-mono">{(stats?.bots || 0).toLocaleString()}</div>
                    </div>
                </div>
            </div>

            {/* Top Bot List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground uppercase tracking-wider border-b border-border pb-1">
                <span>{t('networkActivity.topDetectedAgents', 'Top Detected Agents')}</span>
                <span>{t('networkActivity.hits', 'Hits')}</span>
                </div>
                <div className="space-y-1">
                    {stats?.botTypes.slice(0, 3).map((bot, i) => (
                  <div key={i} className="flex items-center justify-between text-xs font-mono group/item hover:bg-muted/40 p-1 rounded transition-colors">
                            <div className="flex items-center gap-2 truncate max-w-[180px]">
                      <ShieldAlert className="h-3 w-3 text-destructive opacity-50" />
                      <span className="text-foreground truncate" title={bot.browser}>{bot.browser}</span>
                            </div>
                    <span className="text-muted-foreground">{bot.count.toLocaleString()}</span>
                        </div>
                    ))}
                    {(!stats?.botTypes || stats.botTypes.length === 0) && (
                  <div className="text-xs text-muted-foreground italic py-2">{t('networkActivity.noSignificantBotSignatures', 'No significant bot signatures detected.')}</div>
                    )}
                </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
