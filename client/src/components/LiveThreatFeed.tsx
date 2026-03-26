import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal, Activity, Wifi } from 'lucide-react';
import { format } from 'date-fns';
import { UserPreferences } from '@shared/schema';
import { useTranslation } from 'react-i18next';

interface NetworkFlowEvent {
  id: string;
  timestamp: string;
  severity: string;
  eventType: string;
  sourceIP: string;
  destinationIP: string;
  protocol: string | null;
  action: string | null;
  message: string | null;
}

// Mock generator for demo mode visual flair
const generateMockEvent = (): NetworkFlowEvent => {
  const types = ['PORT_SCAN', 'SQL_INJECTION', 'XSS_ATTEMPT', 'DDOS_PACKET', 'MALWARE_C2', 'SSH_BRUTEFORCE', 'EXFILTRATION'];
  const severities = ['critical', 'high', 'medium', 'low', 'info'];
  const actions = ['blocked', 'flagged', 'monitored', 'allowed'];
  const protocols = ['TCP', 'UDP', 'HTTP', 'HTTPS', 'ICMP'];
  
  const type = types[Math.floor(Math.random() * types.length)];
  const severity = severities[Math.floor(Math.random() * severities.length)];
  const action = actions[Math.floor(Math.random() * actions.length)];
  
  return {
    id: Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
    severity,
    eventType: type,
    sourceIP: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    destinationIP: `192.168.1.${Math.floor(Math.random() * 255)}`,
    protocol: protocols[Math.floor(Math.random() * protocols.length)],
    action,
    message: 'Detected suspicious activity pattern'
  };
};

export function LiveThreatFeed() {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [localEvents, setLocalEvents] = useState<NetworkFlowEvent[]>([]);
  
  const { data: preferences } = useQuery<UserPreferences>({
    queryKey: ['/api/user/preferences'],
  });
  
  const isDemo = preferences?.monitoringMode !== 'real';

  // Real data polling
  const { data: realEvents = [] } = useQuery<NetworkFlowEvent[]>({
    queryKey: ['/api/network/flow'],
    refetchInterval: 5000,
    enabled: !!preferences && !isDemo,
  });

  // Effect to merge real/mock events into a scrolling buffer
  useEffect(() => {
    if (isDemo) {
      // Demo mode: Generate fake traffic
      const interval = setInterval(() => {
        setLocalEvents(prev => {
           const newEvent = generateMockEvent();
           const updated = [...prev, newEvent];
           // Keep buffer manageable
           if (updated.length > 50) return updated.slice(updated.length - 50);
           return updated;
        });
      }, 1500 + Math.random() * 2000); // Random delay 1.5-3.5s for realism
      return () => clearInterval(interval);
    } else {
      // Real mode: Sync with API
      // We only want to append NEW events from the API to our local buffer to avoid jitter
      if (realEvents.length > 0) {
         setLocalEvents(prev => {
             // Simple dedup based on ID (assuming API returns recent list)
             const existingIds = new Set(prev.map(e => e.id));
             // Because API returns recent 100, we check specifically for IDs not in our buffer
             const newItems = realEvents.filter(e => !existingIds.has(e.id));
             if (newItems.length === 0) return prev;
             
             // Sort by time
             const combined = [...prev, ...newItems]
                .sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
             
             if (combined.length > 50) return combined.slice(combined.length - 50);
             return combined;
         });
      }
    }
  }, [isDemo, realEvents]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
        const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
           viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [localEvents]);

  return (
    <Card className="col-span-1 md:col-span-3 lg:col-span-7 h-[400px] flex flex-col bg-card border-border shadow-xl overflow-hidden relative group transition-all hover:border-muted-foreground/40">
      {/* Decorative scanline and vignetting */}
      <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--background)/0)_50%,hsl(var(--foreground)/0.05)_50%),linear-gradient(90deg,hsl(var(--destructive)/0.06),hsl(var(--primary)/0.03),hsl(var(--chart-2)/0.05))] z-[5] pointer-events-none bg-[length:100%_4px,3px_100%] opacity-20" />
      
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b border-border bg-muted/30 relative z-10">
        <CardTitle className="text-sm font-medium font-mono flex items-center gap-2 text-primary">
          <Terminal className="h-4 w-4" />
          {t('networkActivity.networkFlow', 'Network Flow')} // {isDemo ? t('networkActivity.simulationMode', 'Simulation Mode') : t('networkActivity.liveFeed', 'Live Feed')}
        </CardTitle>
        <div className="flex gap-3 items-center">
           <Badge variant="outline" className="text-xs font-mono border-primary/30 text-primary bg-primary/10">
             <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse mr-1.5" />
             {localEvents.length} {t('networkActivity.eventsLabel', 'events')}
           </Badge>
           <Activity className="h-4 w-4 text-muted-foreground animate-pulse" />
        </div>
      </CardHeader>
      
      <CardContent className="p-0 flex-1 relative font-mono text-xs z-10">
        <ScrollArea className="h-full p-4" ref={scrollRef}>
          <div className="space-y-2">
             {localEvents.length === 0 && (
                <div className="text-muted-foreground italic flex items-center gap-2 animate-pulse mt-4 ml-2">
                    <Wifi className="h-3 w-3" />
                    {t('networkActivity.initializingCapture', 'Initializing flow capture...')}
                </div>
             )}
             {localEvents.map((event, i) => (
               <div key={event.id || i} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-1.5 border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors px-2 rounded-sm group/row">
                 <span className="text-muted-foreground shrink-0 w-20">
                   {format(new Date(event.timestamp), 'HH:mm:ss')}
                 </span>
                 
                 <Badge variant="outline" className={`
                    shrink-0 w-24 justify-center border-0 bg-opacity-10
                    ${event.severity === 'critical' ? 'text-red-400 bg-red-900/20 shadow-[0_0_10px_-3px_rgba(248,113,113,0.3)]' : 
                      event.severity === 'high' ? 'text-orange-400 bg-orange-900/20' : 
                      event.severity === 'medium' ? 'text-yellow-400 bg-yellow-900/20' :
                      'text-blue-400 bg-blue-900/20'}
                 `}>
                   {event.severity}
                 </Badge>

                  <span className="text-foreground font-bold shrink-0 min-w-32">
                   {event.eventType}
                 </span>

                  <div className="flex flex-1 items-center gap-2 text-muted-foreground min-w-0">
                    <span className="text-muted-foreground text-[10px] w-10">{event.protocol || 'TCP'}</span>
                    <span className="truncate max-w-[120px]" title={event.sourceIP}>{event.sourceIP}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="truncate max-w-[120px]" title={event.destinationIP}>{event.destinationIP}</span>
                 </div>
                 
                 {event.action === 'blocked' && (
                      <Badge variant="destructive" className="ml-auto text-[10px] h-5 px-1.5 uppercase tracking-wider shadow-sm shadow-destructive/30">{t('threats.statuses.blocked', 'Blocked')}</Badge>
                 )}
                 {event.action === 'allowed' && (
                      <span className="ml-auto text-[10px] text-emerald-600 uppercase tracking-wider px-1.5 opacity-50 group-hover/row:opacity-100">{t('threats.statuses.allowed', 'Allowed')}</span>
                 )}
               </div>
             ))}
             {/* Dummy element for scroll padding */}
             <div className="h-4" />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
