import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import Alerts from '@/pages/Alerts';
import Threats from '@/pages/Threats';

export default function SecurityCenter() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();

  const currentTabFromUrl = useMemo(() => {
    const qs = location.split('?')[1] || '';
    const params = new URLSearchParams(qs);
    const tab = params.get('tab');
    return tab === 'threats' ? 'threats' : 'alerts';
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
      <div>
        <h1 className="text-3xl font-bold">{t('nav.securityCenter', 'Security Center')}</h1>
        <p className="text-muted-foreground mt-1">{t('securityCenter.subtitle', 'Unify your Alerts and Threat Log in one place.')}</p>
      </div>

      <Tabs value={tab} onValueChange={onTabChange} className="w-full">
        <TabsList>
          <TabsTrigger value="alerts">{t('nav.alerts', 'Alerts')}</TabsTrigger>
          <TabsTrigger value="threats">{t('nav.threats', 'Threat Log')}</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="mt-4">
          {/* Reuse existing Alerts page component */}
          <Alerts />
        </TabsContent>

        <TabsContent value="threats" className="mt-4">
          {/* Reuse existing Threats page component */}
          <Threats />
        </TabsContent>
      </Tabs>
    </div>
  );
}
