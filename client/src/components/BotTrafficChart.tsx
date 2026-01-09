import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Bot, User as UserIcon, ShieldAlert, Cpu } from 'lucide-react';

interface BotStats {
  total: number;
  bots: number;
  humans: number;
  botTypes: Array<{ browser: string; count: number }>;
}

export function BotTrafficChart() {
  const { data: stats, isLoading } = useQuery<BotStats>({
    queryKey: ['/api/network/bot-stats'],
    refetchInterval: 15000,
  });

  const data = [
    { name: 'Legitimate Traffic', value: stats?.humans || 0, color: '#10b981' }, // Emerald-500
    { name: 'Automated/Bot Traffic', value: stats?.bots || 0, color: '#ef4444' }, // Red-500
  ];

  const total = (stats?.humans || 0) + (stats?.bots || 0);
  const botPercentage = total > 0 ? Math.round(((stats?.bots || 0) / total) * 100) : 0;

  return (
    <Card className="h-full bg-[#0c0c14] border-slate-800 shadow-xl overflow-hidden relative group">
      {/* Background Matrix Effect (Subtle) */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,23,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(0,0,0,0.06),rgba(100,255,100,0.02),rgba(0,0,0,0.06))] z-[5] pointer-events-none bg-[length:100%_4px,3px_100%] opacity-20" />

      <CardHeader className="border-b border-slate-800 bg-slate-900/50 relative z-10 py-3">
        <CardTitle className="text-sm font-medium font-mono flex items-center gap-2 text-blue-400">
          <Cpu className="h-4 w-4" />
          TRAFFIC_ANALYZER // CLASSIFICATION
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
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '4px', color: '#f8fafc' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
            </PieChart>
          </ResponsiveContainer>
          
          {/* Centered Percentage */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className={`text-3xl font-bold ${botPercentage > 30 ? 'text-red-500' : 'text-slate-200'}`}>
              {botPercentage}%
            </span>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest">BOT LOAD</span>
          </div>
        </div>

        {/* Right Side: Stats & Breakdown */}
        <div className="flex-1 w-full space-y-4">
            {/* Top Stats */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900/50 p-3 rounded border border-slate-800 flex items-center gap-3">
                    <div className="p-2 bg-green-500/10 rounded-full">
                        <UserIcon className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider">Humans</div>
                        <div className="text-lg font-bold text-slate-200 font-mono">{(stats?.humans || 0).toLocaleString()}</div>
                    </div>
                </div>
                <div className={`bg-slate-900/50 p-3 rounded border border-slate-800 flex items-center gap-3 ${botPercentage > 50 ? 'animate-pulse border-red-900/50' : ''}`}>
                    <div className="p-2 bg-red-500/10 rounded-full">
                        <Bot className="h-4 w-4 text-red-500" />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider">Bots</div>
                        <div className="text-lg font-bold text-slate-200 font-mono">{(stats?.bots || 0).toLocaleString()}</div>
                    </div>
                </div>
            </div>

            {/* Top Bot List */}
            <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800 pb-1">
                    <span>Top Detected Agents</span>
                    <span>Hits</span>
                </div>
                <div className="space-y-1">
                    {stats?.botTypes.slice(0, 3).map((bot, i) => (
                        <div key={i} className="flex items-center justify-between text-xs font-mono group/item hover:bg-slate-800/30 p-1 rounded transition-colors">
                            <div className="flex items-center gap-2 truncate max-w-[180px]">
                                <ShieldAlert className="h-3 w-3 text-red-400 opacity-50" />
                                <span className="text-slate-300 truncate" title={bot.browser}>{bot.browser}</span>
                            </div>
                            <span className="text-slate-500">{bot.count.toLocaleString()}</span>
                        </div>
                    ))}
                    {(!stats?.botTypes || stats.botTypes.length === 0) && (
                        <div className="text-xs text-slate-600 italic py-2">No significant bot signatures detected.</div>
                    )}
                </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
