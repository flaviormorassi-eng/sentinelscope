import React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Flag, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { getSecurityResponseSettings } from '@/lib/securityResponseSettings';

type AlertItem = {
  id: string;
  threatId: string | null;
  title: string;
  message: string;
  severity: string;
  read: boolean;
  timestamp: string;
};

type AlertListResponse = {
  data: AlertItem[];
};

const suspiciousLevels = new Set(['medium', 'high', 'critical']);

function playTone() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 988;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 180);
  } catch {
    // ignore sound errors
  }
}

export function SecurityAlertFlag() {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [promptOpen, setPromptOpen] = React.useState(false);
  const [activeAlert, setActiveAlert] = React.useState<AlertItem | null>(null);
  const seenRef = React.useRef<Set<string>>(new Set());

  const { data } = useQuery<AlertListResponse>({
    queryKey: ['alerts/list/suspicious-live'],
    queryFn: () => apiRequest('GET', '/api/alerts/list?unread=true&limit=50') as Promise<AlertListResponse>,
    refetchInterval: 8000,
  });

  const suspiciousAlerts = React.useMemo(() => {
    const rows = data?.data || [];
    return rows.filter(a => suspiciousLevels.has((a.severity || '').toLowerCase()));
  }, [data]);

  const blockMutation = useMutation({
    mutationFn: async (alert: AlertItem) => {
      if (!alert.threatId) return;
      await apiRequest('POST', `/api/threats/${alert.threatId}/decide`, {
        decision: 'block',
        reason: 'Blocked from live suspicious-alert workflow',
      });
      await apiRequest('POST', `/api/alerts/${alert.id}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts/list/suspicious-live'] });
      queryClient.invalidateQueries({ queryKey: ['threats/list'] });
      toast({ title: 'Blocked', description: 'Suspicious activity has been blocked.' });
    },
    onError: (e: any) => {
      toast({ title: 'Error', description: e?.message || 'Failed to block suspicious activity', variant: 'destructive' });
    },
  });

  const allowMutation = useMutation({
    mutationFn: async (alert: AlertItem) => {
      if (alert.threatId) {
        await apiRequest('POST', `/api/threats/${alert.threatId}/decide`, {
          decision: 'allow',
          reason: 'Allowed from live suspicious-alert workflow',
        });
      }
      await apiRequest('POST', `/api/alerts/${alert.id}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts/list/suspicious-live'] });
      queryClient.invalidateQueries({ queryKey: ['threats/list'] });
      toast({ title: 'Allowed', description: 'Suspicious activity has been marked as allowed.' });
    },
    onError: (e: any) => {
      toast({ title: 'Error', description: e?.message || 'Failed to allow suspicious activity', variant: 'destructive' });
    },
  });

  React.useEffect(() => {
    if (!suspiciousAlerts.length) return;

    const settings = getSecurityResponseSettings();
    const fresh = suspiciousAlerts.find(a => !seenRef.current.has(a.id));
    if (!fresh) return;

    seenRef.current.add(fresh.id);

    if (settings.alertToneEnabled) {
      playTone();
    }

    if (settings.autoBlockEnabled && fresh.threatId) {
      blockMutation.mutate(fresh);
      return;
    }

    if (settings.manualDecisionEnabled) {
      setActiveAlert(fresh);
      setPromptOpen(true);
    }
  }, [suspiciousAlerts]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(true)}
        title="Suspicious alerts"
        aria-label="Suspicious alerts"
      >
        <Flag className="h-4 w-4 text-red-500" />
        {suspiciousAlerts.length > 0 && (
          <Badge className="absolute -top-1 -right-1 bg-red-600 text-white px-1.5 h-5 min-w-5 justify-center">
            {suspiciousAlerts.length}
          </Badge>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-red-500" /> Suspicious alerts</DialogTitle>
            <DialogDescription>Review suspicious events and decide to block or allow.</DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto space-y-3">
            {suspiciousAlerts.length === 0 && (
              <p className="text-sm text-muted-foreground">No suspicious unread alerts.</p>
            )}
            {suspiciousAlerts.map(alert => (
              <div key={alert.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{alert.title}</p>
                  <Badge variant="destructive">{alert.severity}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(alert.timestamp).toLocaleString()}</p>
                <p className="text-sm">{alert.message}</p>
                <p className="text-xs text-muted-foreground">Threat ID: {alert.threatId || 'n/a'}</p>
                <Separator />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={() => blockMutation.mutate(alert)} disabled={blockMutation.isPending || !alert.threatId}>
                    Block
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => allowMutation.mutate(alert)} disabled={allowMutation.isPending}>
                    Pass
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={promptOpen} onOpenChange={setPromptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspicious activity detected</DialogTitle>
            <DialogDescription>
              {activeAlert?.title || 'A suspicious event needs your decision.'}
            </DialogDescription>
          </DialogHeader>
          {activeAlert && (
            <div className="space-y-3">
              <p className="text-sm">{activeAlert.message}</p>
              <p className="text-xs text-muted-foreground">Severity: {activeAlert.severity}</p>
              <p className="text-xs text-muted-foreground">Threat ID: {activeAlert.threatId || 'n/a'}</p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={() => {
                    blockMutation.mutate(activeAlert);
                    setPromptOpen(false);
                  }}
                  disabled={blockMutation.isPending || !activeAlert.threatId}
                >
                  Block
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    allowMutation.mutate(activeAlert);
                    setPromptOpen(false);
                  }}
                  disabled={allowMutation.isPending}
                >
                  Pass
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
