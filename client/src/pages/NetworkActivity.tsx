import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, Filter, Trash2, Search, Calendar, Chrome, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface BrowsingActivity {
  id: number;
  userId: string;
  domain: string;
  url: string;
  ipAddress: string | null;
  browserType: string;
  timestamp: string;
  isFlagged: boolean;
  metadata: Record<string, any> | null;
}

interface BrowsingStats {
  totalVisits: number;
  uniqueDomains: number;
  flaggedDomains: number;
  browserBreakdown: Array<{ browser: string; count: number }>;
  topDomains: Array<{ domain: string; count: number }>;
}

export default function NetworkActivity() {
  const { t } = useTranslation();
  const [domainFilter, setDomainFilter] = useState('');
  const [ipFilter, setIpFilter] = useState('');
  const [browserFilter, setBrowserFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: activities = [], isLoading, refetch } = useQuery<BrowsingActivity[]>({
    queryKey: ['/api/browsing'],
  });

  const { data: stats } = useQuery<BrowsingStats>({
    queryKey: ['/api/browsing/stats'],
  });

  const filteredActivities = activities.filter(activity => {
    if (domainFilter && !activity.domain.toLowerCase().includes(domainFilter.toLowerCase())) {
      return false;
    }
    if (ipFilter) {
      if (!activity.ipAddress || !activity.ipAddress.toLowerCase().includes(ipFilter.toLowerCase())) {
        return false;
      }
    }
    if (browserFilter !== 'all' && activity.browserType !== browserFilter) {
      return false;
    }
    if (dateFrom) {
      const activityDate = new Date(activity.timestamp);
      const fromDate = new Date(dateFrom);
      if (activityDate < fromDate) {
        return false;
      }
    }
    if (dateTo) {
      const activityDate = new Date(activity.timestamp);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (activityDate > toDate) {
        return false;
      }
    }
    return true;
  });

  const getBrowserIcon = (browser: string) => {
    const lowerBrowser = browser.toLowerCase();
    if (lowerBrowser.includes('chrome')) return Chrome;
    return Globe;
  };

  const uniqueBrowsers = Array.from(new Set(activities.map(a => a.browserType)));

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('networkActivity.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('networkActivity.description')}
        </p>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">
                {t('dashboard.totalVisits')}
              </CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="total-visits">
                {stats.totalVisits?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">
                {t('dashboard.uniqueDomains')}
              </CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="unique-domains">
                {stats.uniqueDomains?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">
                {t('dashboard.flaggedDomains')}
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive" data-testid="flagged-domains">
                {stats.flaggedDomains?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">
                {t('dashboard.topBrowser')}
              </CardTitle>
              <Chrome className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold" data-testid="top-browser">
                {stats.browserBreakdown?.[0]?.browser || 'N/A'}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t('networkActivity.filters')}
          </CardTitle>
          <CardDescription>{t('networkActivity.filtersDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('networkActivity.searchDomain')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('networkActivity.searchDomainPlaceholder')}
                  value={domainFilter}
                  onChange={(e) => setDomainFilter(e.target.value)}
                  className="pl-9"
                  data-testid="input-domain-filter"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('networkActivity.searchIp')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('networkActivity.searchIpPlaceholder')}
                  value={ipFilter}
                  onChange={(e) => setIpFilter(e.target.value)}
                  className="pl-9"
                  data-testid="input-ip-filter"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('networkActivity.filterBrowser')}</label>
              <Select value={browserFilter} onValueChange={setBrowserFilter}>
                <SelectTrigger data-testid="select-browser-filter">
                  <SelectValue placeholder={t('networkActivity.allBrowsers')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('networkActivity.allBrowsers')}</SelectItem>
                  {uniqueBrowsers.map(browser => (
                    <SelectItem key={browser} value={browser}>{browser}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('networkActivity.dateFrom')}</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                data-testid="input-date-from"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('networkActivity.dateTo')}</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                data-testid="input-date-to"
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setDomainFilter('');
                  setIpFilter('');
                  setBrowserFilter('all');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="w-full"
                data-testid="button-clear-filters"
              >
                {t('networkActivity.clearFilters')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('networkActivity.browsingHistory')}
          </CardTitle>
          <CardDescription>
            {filteredActivities.length} {t('networkActivity.recordsFound')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : filteredActivities.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('networkActivity.noData')}</AlertTitle>
              <AlertDescription>
                {t('networkActivity.noDataDescription')}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredActivities.map((activity) => {
                const BrowserIcon = getBrowserIcon(activity.browserType);
                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-4 rounded-lg border hover-elevate"
                    data-testid={`activity-${activity.id}`}
                  >
                    <BrowserIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <p className="font-medium font-mono text-sm truncate">
                          {activity.domain}
                        </p>
                        {activity.isFlagged && (
                          <Badge variant="destructive" className="text-xs">
                            {t('networkActivity.flagged')}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {activity.browserType}
                        </Badge>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {format(new Date(activity.timestamp), 'PPp')}
                        </span>
                      </div>
                      {activity.url && activity.url !== activity.domain && (
                        <p className="text-xs text-muted-foreground font-mono mb-1 truncate">
                          {activity.url}
                        </p>
                      )}
                      {activity.ipAddress && (
                        <p className="text-xs text-muted-foreground">
                          IP: {activity.ipAddress}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
