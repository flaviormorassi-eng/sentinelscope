import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Radar, Siren, ShieldAlert, ShieldCheck } from 'lucide-react';
import Alerts from '@/pages/Alerts';
import Threats from '@/pages/Threats';
import SocCenter from '@/pages/SocCenter';

export default function SecurityCenter() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();

  const currentTabFromUrl = useMemo(() => {
    const qs = location.split('?')[1] || '';
    const params = new URLSearchParams(qs);
    const tab = params.get('tab');
    return tab === 'threats' || tab === 'soc' ? tab : 'alerts';
  }, [location]);

  const [tab, setTab] = useState<string>(currentTabFromUrl);

  useEffect(() => {
    // Sync state if URL changes externally
    if (currentTabFromUrl !== tab) setTab(currentTabFromUrl);
  }, [currentTabFromUrl]);

  const onTabChange = (value: string) => {
    setTab(value);
    const base = location.split('?')[0];
    const qs = new URLSearchParams(location.split('?')[1] || '');
    qs.set('tab', value);
    setLocation(`${base}?${qs.toString()}`);
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-security-center">
      <Card className="relative overflow-hidden border-border/60">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-chart-3/10" />
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full border border-primary/25" />
        <CardContent className="relative p-4 md:p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Radar className="h-3.5 w-3.5 text-primary" />
                {t('securityCenter.commandCore', 'Unified Security Core')}
              </div>
              <h1 className="text-3xl font-bold tracking-tight">{t('nav.securityCenter', 'Security Center')}</h1>
              <p className="text-muted-foreground">{t('securityCenter.subtitle', 'Unify your Alerts and Threat Log in one place.')}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-md border bg-background/60 px-3 py-2 min-w-[160px]">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('securityCenter.alertGrid', 'Alert Grid')}</p>
                <p className="text-sm font-semibold flex items-center gap-2"><Siren className="h-4 w-4 text-chart-5" />{t('securityCenter.liveTriage', 'Live Triage')}</p>
              </div>
              <div className="rounded-md border bg-background/60 px-3 py-2 min-w-[160px]">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('securityCenter.threatLog', 'Threat Log')}</p>
                <p className="text-sm font-semibold flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-destructive" />{t('securityCenter.huntAndTrack', 'Hunt & Track')}</p>
              </div>
              <div className="rounded-md border bg-background/60 px-3 py-2 min-w-[160px]">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('securityCenter.socOps', 'SOC Ops')}</p>
                <p className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />{t('securityCenter.controlledResponse', 'Controlled Response')}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={onTabChange} className="w-full">
        <TabsList className="w-full justify-start gap-2 p-1 bg-muted/40 rounded-lg border border-border/60">
          <TabsTrigger value="alerts" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
            {t('nav.alerts', 'Alerts')}
          </TabsTrigger>
          <TabsTrigger value="threats" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
            {t('nav.threats', 'Threat Log')}
          </TabsTrigger>
          <TabsTrigger value="soc" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
            {t('nav.socCenter', 'SOC Center')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="mt-4">
          {/* Reuse existing Alerts page component */}
          <Alerts />
        </TabsContent>

        <TabsContent value="threats" className="mt-4">
          {/* Reuse existing Threats page component */}
          <Threats />
        </TabsContent>

        <TabsContent value="soc" className="mt-4">
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{t('securityCenter.socCenterBadge', 'SOC Mission Control')}</Badge>
          </div>
          <SocCenter embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
