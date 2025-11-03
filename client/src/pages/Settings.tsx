import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Save, AlertCircle, Clock, CreditCard } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Link } from 'wouter';

interface UserPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  alertThreshold: string;
  monitoringMode: string;
  browsingMonitoringEnabled: boolean;
  browsingHistoryEnabled: boolean;
  browsingConsentGivenAt: string | null;
}

interface RealMonitoringAccess {
  canAccess: boolean;
  reason: 'paid_subscription' | 'active_trial' | 'no_access';
  trialStatus?: {
    isActive: boolean;
    expiresAt: string | null;
    hoursRemaining: number | null;
  };
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const [language, setLanguage] = useState(i18n.language);
  const [selectedTheme, setSelectedTheme] = useState(theme);

  const { data: preferences } = useQuery<UserPreferences>({
    queryKey: ['/api/user/preferences'],
  });

  const { data: realMonitoringAccess } = useQuery<RealMonitoringAccess>({
    queryKey: ['/api/user/real-monitoring-access'],
  });

  const [emailNotifications, setEmailNotifications] = useState(preferences?.emailNotifications ?? true);
  const [pushNotifications, setPushNotifications] = useState(preferences?.pushNotifications ?? true);
  const [alertThreshold, setAlertThreshold] = useState(preferences?.alertThreshold ?? 'medium');
  const [monitoringMode, setMonitoringMode] = useState(preferences?.monitoringMode ?? 'demo');
  const [browsingMonitoringEnabled, setBrowsingMonitoringEnabled] = useState(preferences?.browsingMonitoringEnabled ?? false);
  const [browsingHistoryEnabled, setBrowsingHistoryEnabled] = useState(preferences?.browsingHistoryEnabled ?? false);

  useEffect(() => {
    if (preferences) {
      setEmailNotifications(preferences.emailNotifications);
      setPushNotifications(preferences.pushNotifications);
      setAlertThreshold(preferences.alertThreshold);
      setMonitoringMode(preferences.monitoringMode);
      setBrowsingMonitoringEnabled(preferences.browsingMonitoringEnabled);
      setBrowsingHistoryEnabled(preferences.browsingHistoryEnabled);
    }
  }, [preferences]);

  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PUT', '/api/user/preferences', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/preferences'] });
      toast({
        title: t('settings.saved'),
        description: "Your settings have been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    // Save language
    i18n.changeLanguage(language);
    localStorage.setItem('language', language);

    // Save theme
    setTheme(selectedTheme);

    // Save preferences
    updatePreferencesMutation.mutate({
      emailNotifications,
      pushNotifications,
      alertThreshold,
      monitoringMode,
      browsingMonitoringEnabled,
      browsingHistoryEnabled,
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.profile')}</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user?.photoURL || undefined} />
                <AvatarFallback className="text-lg">
                  {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{user?.displayName || 'User'}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('settings.preferences')}</CardTitle>
            <CardDescription>Customize your experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="language">{t('settings.language')}</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="language" data-testid="select-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">{t('settings.languages.en')}</SelectItem>
                  <SelectItem value="pt">{t('settings.languages.pt')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme">{t('settings.theme')}</Label>
              <Select value={selectedTheme} onValueChange={(v) => setSelectedTheme(v as 'light' | 'dark')}>
                <SelectTrigger id="theme" data-testid="select-theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t('settings.themes.light')}</SelectItem>
                  <SelectItem value="dark">{t('settings.themes.dark')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.notifications')}</CardTitle>
          <CardDescription>Manage how you receive alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications">{t('settings.emailNotifications')}</Label>
              <p className="text-sm text-muted-foreground">
                Receive threat alerts via email
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
              data-testid="switch-email-notifications"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push-notifications">{t('settings.pushNotifications')}</Label>
              <p className="text-sm text-muted-foreground">
                Receive push notifications for critical threats
              </p>
            </div>
            <Switch
              id="push-notifications"
              checked={pushNotifications}
              onCheckedChange={setPushNotifications}
              data-testid="switch-push-notifications"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="alert-threshold">{t('settings.alertThreshold')}</Label>
            <Select value={alertThreshold} onValueChange={setAlertThreshold}>
              <SelectTrigger id="alert-threshold" data-testid="select-alert-threshold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{t('settings.thresholds.low')}</SelectItem>
                <SelectItem value="medium">{t('settings.thresholds.medium')}</SelectItem>
                <SelectItem value="high">{t('settings.thresholds.high')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Control which threats trigger notifications
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monitoring Mode</CardTitle>
          <CardDescription>Choose between demo data or real-time monitoring</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="monitoring-mode">Data Source</Label>
            <Select value={monitoringMode} onValueChange={setMonitoringMode}>
              <SelectTrigger id="monitoring-mode" data-testid="select-monitoring-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="demo">Demo Mode (Simulated Data)</SelectItem>
                <SelectItem value="real">Real Monitoring (Live Data)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {monitoringMode === 'demo' 
                ? 'Using simulated threat data for demonstration purposes'
                : 'Connected to real-time security monitoring sources'}
            </p>
          </div>

          {/* Access Status Alerts */}
          {realMonitoringAccess && monitoringMode === 'real' && (
            <>
              {realMonitoringAccess.reason === 'paid_subscription' && (
                <Alert className="border-green-500/50 bg-green-500/10">
                  <CreditCard className="h-4 w-4 text-green-500" />
                  <AlertTitle className="text-green-500">Paid Subscription Active</AlertTitle>
                  <AlertDescription className="text-muted-foreground">
                    You have unlimited access to real monitoring with your current plan.
                  </AlertDescription>
                </Alert>
              )}

              {realMonitoringAccess.reason === 'active_trial' && realMonitoringAccess.trialStatus && (
                <Alert className="border-yellow-500/50 bg-yellow-500/10">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <AlertTitle className="text-yellow-500">Free Trial Active</AlertTitle>
                  <AlertDescription className="text-muted-foreground">
                    {realMonitoringAccess.trialStatus.hoursRemaining} hours remaining. 
                    <Link href="/subscription">
                      <span className="text-yellow-500 underline cursor-pointer">Upgrade now</span>
                    </Link>
                    {' '}to continue after trial ends.
                  </AlertDescription>
                </Alert>
              )}

              {realMonitoringAccess.reason === 'no_access' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Trial Expired</AlertTitle>
                  <AlertDescription>
                    Your 24-hour free trial has ended. 
                    <Link href="/subscription">
                      <span className="text-destructive-foreground underline cursor-pointer">Upgrade to a paid plan</span>
                    </Link>
                    {' '}to continue using real monitoring.
                  </AlertDescription>
                </Alert>
              )}

              {realMonitoringAccess.canAccess && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-medium mb-2">📡 Real Monitoring Active</p>
                  <p className="text-sm text-muted-foreground">
                    Configure your data sources in the Event Sources page to start receiving real-time security events.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy & Network Monitoring</CardTitle>
          <CardDescription>Control how we collect and process your browsing activity data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="browsing-monitoring">Network Activity Monitoring</Label>
              <p className="text-sm text-muted-foreground">
                Monitor DNS queries and network connections for security threats
              </p>
            </div>
            <Switch
              id="browsing-monitoring"
              checked={browsingMonitoringEnabled}
              onCheckedChange={setBrowsingMonitoringEnabled}
              data-testid="switch-browsing-monitoring"
            />
          </div>

          {browsingMonitoringEnabled && (
            <>
              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="browsing-history">Full Browser History</Label>
                  <p className="text-sm text-muted-foreground">
                    Capture complete browsing history with URLs (HTTPS sites show domain only)
                  </p>
                </div>
                <Switch
                  id="browsing-history"
                  checked={browsingHistoryEnabled}
                  onCheckedChange={setBrowsingHistoryEnabled}
                  data-testid="switch-browsing-history"
                />
              </div>

              <Alert className="border-blue-500/50 bg-blue-500/10">
                <AlertCircle className="h-4 w-4 text-blue-500" />
                <AlertTitle className="text-blue-500">Privacy Notice</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  Network monitoring data is encrypted and stored securely. You can delete your browsing history at any time. 
                  We comply with GDPR and LGPD privacy regulations.
                </AlertDescription>
              </Alert>

              {preferences?.browsingConsentGivenAt && (
                <p className="text-sm text-muted-foreground">
                  Consent given on: {new Date(preferences.browsingConsentGivenAt).toLocaleDateString()}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updatePreferencesMutation.isPending}
          size="lg"
          data-testid="button-save-settings"
        >
          <Save className="h-4 w-4 mr-2" />
          {t('settings.save')}
        </Button>
      </div>
    </div>
  );
}
